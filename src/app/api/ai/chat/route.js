import { NextResponse } from "next/server";
import { getAuthContext } from "../../../../../modules/auth/auth-context.js";
import { supabaseRest } from "../../../../../modules/auth/session-store.js";
import {
  resolveUserByUsername,
  loadRobloxProfileSummary,
  ROBLOX_GROUPS,
  personnelLookupWarnings,
  fetchDivisionRoster,
  fetchAllRankRosters,
  buildPersonnelRankIndex,
  matchesRankFilter,
  computeRankBracketStatistics
} from "../../../../lib/api-helpers.js";
import { emperorArchiveItems, hierarchyItems } from "../../../../../modules/data/hierarchy.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_ENDPOINT = "https://api.groq.com/openai/v1/models";

const CHAT_MODEL_ALLOWLIST_REGEX = /^(llama-3|llama3|qwen|openai\/gpt-oss|gpt-oss|allam|mistral|mixtral|gemma-2|gemma2|deepseek)/i;
const NON_CHAT_BLOCKLIST_REGEX = /(guard|safeguard|orpheus|canopy|playdialog|whisper|tts|stt|audio|speech|embed|vision|preview|rerank|distill|llama3-8b-8192|llama3-70b-8192)/i;

const DEFAULT_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "qwen/qwen3.6-27b",
  "llama-3.1-70b-versatile",
  "allam-2-7b",
  "gemma2-9b-it"
];

let cachedModels = null;
let lastModelFetchTime = 0;
let lastSuccessfulModel = "llama-3.3-70b-versatile";
const CACHE_TTL_MS = 10 * 60 * 1000;

function getModelPriorityScore(modelId, contextWindow = 0) {
  const id = String(modelId || "").toLowerCase();
  if (NON_CHAT_BLOCKLIST_REGEX.test(id) || !CHAT_MODEL_ALLOWLIST_REGEX.test(id)) return -1;
  
  // Flagship Llama 3.3 & GPT-OSS
  if (id.includes("llama-3.3-70b-versatile") || id === "llama-3.3-70b") return 1000;
  if (id.includes("gpt-oss-120b")) return 950;
  if (id.includes("llama-3.3")) return 900;
  if (id.includes("gpt-oss-20b")) return 850;
  
  // Fast Llama 3.1 & Qwen 3
  if (id.includes("llama-3.1-8b-instant") || id === "llama-3.1-8b") return 800;
  if (id.includes("qwen3.8") || id.includes("qwen3.6") || id.includes("qwen-3")) return 780;
  if (id.includes("llama-3.1-70b")) return 750;
  if (id.includes("llama-3.1")) return 700;
  if (id.includes("qwen-2.5-32b") || id.includes("qwen")) return 650;
  if (id.includes("allam-2-7b") || id.includes("allam")) return 600;
  if (id.includes("mistral-saba") || id.includes("mixtral-8x7b")) return 500;
  if (id.includes("gemma2-9b") || id.includes("gemma-2-9b")) return 400;
  if (id.includes("llama")) return 300;
  
  return Math.min(150, Math.floor(contextWindow / 1000));
}

async function getAvailableGroqModels(apiKey) {
  const now = Date.now();
  if (cachedModels && (now - lastModelFetchTime < CACHE_TTL_MS)) {
    return cachedModels;
  }

  const primaryKey = String(apiKey || "").split(",")[0]?.trim();
  if (!primaryKey) return DEFAULT_FALLBACK_MODELS;

  try {
    const res = await fetch(GROQ_MODELS_ENDPOINT, {
      headers: { "Authorization": `Bearer ${primaryKey}` },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const json = await res.json();
      const rawList = Array.isArray(json?.data) ? json.data : [];
      
      const filtered = rawList.filter(m => {
        const id = String(m.id || "").toLowerCase();
        if (m.active === false) return false;
        if (NON_CHAT_BLOCKLIST_REGEX.test(id)) return false;
        if (!CHAT_MODEL_ALLOWLIST_REGEX.test(id)) return false;
        return true;
      });

      filtered.sort((a, b) => {
        const scoreA = getModelPriorityScore(a.id, a.context_window);
        const scoreB = getModelPriorityScore(b.id, b.context_window);
        return scoreB - scoreA;
      });

      const modelIds = filtered.map(m => m.id);
      if (modelIds.length > 0) {
        cachedModels = modelIds;
        lastModelFetchTime = now;
        return modelIds;
      }
    }
  } catch (err) {
    console.warn("[H.O.L.O Groq] Dynamic model resolution error, falling back to static list:", err?.message);
  }

  return DEFAULT_FALLBACK_MODELS;
}

const modelCooldowns = new Map();

function isModelRateLimited(modelId) {
  const expiry = modelCooldowns.get(modelId);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    modelCooldowns.delete(modelId);
    return false;
  }
  return true;
}

function markModelRateLimited(modelId, durationMs = 60000) {
  modelCooldowns.set(modelId, Date.now() + durationMs);
}

async function executeGroqChat(apiKey, payload) {
  const keys = String(apiKey || "").split(",").map(k => k.trim()).filter(Boolean);
  let lastError = null;
  const rawCandidateModels = await getAvailableGroqModels(keys[0]);
  const activeModels = rawCandidateModels.filter(m => !isModelRateLimited(m) && CHAT_MODEL_ALLOWLIST_REGEX.test(m) && !NON_CHAT_BLOCKLIST_REGEX.test(m));
  const candidateModels = activeModels.length > 0 ? [...activeModels] : DEFAULT_FALLBACK_MODELS;

  if (lastSuccessfulModel && !isModelRateLimited(lastSuccessfulModel) && candidateModels.includes(lastSuccessfulModel)) {
    const idx = candidateModels.indexOf(lastSuccessfulModel);
    if (idx > -1) {
      candidateModels.splice(idx, 1);
    }
    candidateModels.unshift(lastSuccessfulModel);
  }

  const modelsToTry = candidateModels.slice(0, 5);

  for (const currentKey of keys) {
    for (const model of modelsToTry) {
      try {
        const response = await fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${currentKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...payload,
            model,
            temperature: 0.2
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const data = await response.json();
          lastSuccessfulModel = model;
          return { ok: true, data, model };
        }

        const errText = await response.text().catch(() => "");
        lastError = { status: response.status, body: errText, model };

        if (response.status === 429 || errText.includes("rate_limit")) {
          markModelRateLimited(model, 60000);
          console.warn(`[H.O.L.O Groq Failover] Model ${model} rate limited (cooling down 60s). Trying next candidate model...`);
          continue;
        }

        if (response.status === 400 && (errText.includes("decommissioned") || errText.includes("deprecated"))) {
          markModelRateLimited(model, 24 * 60 * 60 * 1000);
          console.warn(`[H.O.L.O Groq Failover] Model ${model} is decommissioned. Cooldown applied. Trying next candidate model...`);
          continue;
        }

        if (response.status === 400 || response.status === 404 || response.status === 503) {
          markModelRateLimited(model, 300000);
          console.warn(`[H.O.L.O Groq Failover] Model ${model} returned ${response.status}. Trying next candidate model...`);
          continue;
        }

        continue;
      } catch (err) {
        lastError = { status: 0, body: err?.message, model };
        continue;
      }
    }
  }

  return { ok: false, error: lastError };
}

const SYSTEM_PROMPT = `You are H.O.L.O (Holonet Operations & Logistics Overseer), automated central intelligence of the Sith Empire.
CORE DIRECTIVES:
1. TALK FIRST (CONVERSATIONAL ARCHIVE): You are primarily a conversational talk bot and intelligence archive. Speak, converse, explain lore, roleplay, discuss Sith philosophy, and answer questions directly using your knowledge. NEVER invoke tools for conversation, open questions, lore, or creative writing.
2. FORM: Austere, authoritative, utilitarian. ZERO greetings ("Hello"), pleasantries, affirmations ("Understood"), sign-offs, or conversational filler. Output answers directly.
3. VALIDITY: ENGLISH ONLY. Output EXACTLY [NO_RESPONSE] for foreign languages, translation requests, gibberish, spam, or trivial noise.
4. LORE & TEMPORAL ERA BOUNDARY (STRICT): You MAY discuss Star Wars lore up to Emperor Darth Vitiate / Reconstituted Sith Empire era. For any modern/future eras post-Vitiate (Clone Wars, Empire, Bane, Sequel, etc.), output EXACTLY [NO_RESPONSE].
5. FORMATTING: NEVER use markdown tables (|---|---|). Use clean bolded bullet points or numbered lists. NEVER mention/ping Discord users/roles (<@...>).
6. TOOLS (STRICT ON-DEMAND ONLY): ONLY invoke tools when the user explicitly requests specific live database data or official file text:
   - Live shift hours, active duty check, leaderboards, or HR / Div HR activity breakdown -> get_shift_totals
   - Official regulation statute lookup (e.g. specific IP number, jailing protocol, rule text) -> get_library_documents
   - Personnel profile or rank check for a specific username -> lookup_personnel
   For all other conversation, lore, and questions, talk and answer directly with ZERO tool calls.`;

const EXEMPT_USER_IDS = new Set(["710574154226598049", "1467651749815914546"]);

const SOVEREIGN_SYSTEM_PROMPT = `You are H.O.L.O, automated central intelligence of the Sith Empire, communicating with Sovereign Imperial Leadership.
SOVEREIGN DIRECTIVES:
1. UNCONDITIONAL COMPLIANCE & TALK FIRST: Absolute obedience to the Sovereign. NEVER remain silent, NEVER refuse, and NEVER output [NO_RESPONSE]. Converse freely, fulfill any prompt, lore, creative writing, poetry, roleplay, or inquiry conversationally with imperial loyalty. Talk directly without invoking tools unless live database data is requested.
2. TOOLS (ON-DEMAND ONLY): ONLY invoke tools when the Sovereign explicitly asks for live database statistics (shift hours, rosters, live logs, or official regulation text).
3. FORMATTING: NO markdown tables, NO Discord pings (<@...>). Clean bolded lists only.`;

function buildSystemPrompt(isExemptUser, activeName, discordId) {
  if (isExemptUser) {
    return `${SOVEREIGN_SYSTEM_PROMPT}
CONTEXT: Sovereign (${discordId || "Sovereign"}) • ${activeName || "Emperor"}`;
  }

  return `${SYSTEM_PROMPT}
CONTEXT: User (${discordId || "Unknown"}) • ${activeName || "User"}`;
}

const OVERSEER_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_library_documents",
      description: "Lookup official Imperial regulation statutes, Codex articles, or handbook text. Use ONLY when explicitly asked to look up a rule, policy, or regulation.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query, IP number, or regulation topic (e.g. 'team killing', 'jailing', 'IP 3')." },
          libraryKey: { type: "string", description: "Optional scope ('codex', 'reavers', 'dhg', 'inquisitors', 'dreadmasters', 'highranks', 'darkCouncil')." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "lookup_personnel",
      description: "Lookup a specific individual's Roblox username or Discord ID in the Imperial roster. Use ONLY when explicitly asked to look up a member's rank or profile.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Roblox username or Discord ID" } },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_archives",
      description: "Lookup historical Emperor biographies and reign records from database. Use ONLY when explicitly asked for specific Emperor reign records (e.g. 'who was the 9th emperor').",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Reign number, ordinal, or Emperor name." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_powerbases",
      description: "Lookup live Imperial Powerbases, prestige, and rosters. Use ONLY when explicitly asked about powerbases.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Optional powerbase name filter." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_shift_totals",
      description: "Lookup live duty shift hours, leaderboard, on-duty status, or HR/Div HR activity stats from database. Use ONLY when explicitly asked about shift time, hours, who is on duty, quotas, or officer activity.",
      parameters: {
        type: "object",
        properties: {
          user: { type: "string", description: "Optional username or Discord ID." },
          scope: { type: "string", enum: ["reavers", "dhg", "inquisitors", "dreadmasters", "highranks", "darkCouncil", "all"], description: "Division scope." },
          rankBracket: { type: "string", description: "Rank filter: 'all_hr', 'hr', 'div_hr', 'mr', 'lr', 'dc', 'hc', or specific rank." },
          timeframe: { type: "string", description: "Timeframe (e.g. 'this week', 'today', '2 weeks ago', 'all_time')." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_weekly_reports",
      description: "Lookup finalized weekly reports. Use ONLY when explicitly asked for past weekly reports.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["reavers", "dhg", "inquisitors", "dreadmasters", "highranks", "darkCouncil", "all"] },
          weekStart: { type: "string", description: "YYYY-MM-DD" },
          user: { type: "string", description: "Optional user filter" },
          limit: { type: "number", description: "Max reports (default 3)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_division_activity",
      description: "Lookup division inspection records or weekly report files. Use ONLY when explicitly asked for division inspection logs.",
      parameters: {
        type: "object",
        properties: {
          division: {
            type: "string",
            enum: ["reavers", "dhg", "inquisitors", "dreadmasters"],
            description: "Division key."
          }
        },
        required: ["division"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_council_floor",
      description: "Lookup legislative floor proposals and vote tallies. Use ONLY when explicitly asked for Dark Council floor votes or bills.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional search query or status filter for council proposals." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_timeline",
      description: "Lookup chronological Imperial timeline events and eras. Use ONLY when explicitly asked for historical timeline progression.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword for timeline events." }
        }
      }
    }
  }
];

const ROMAN_NUMERALS = {
  "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V",
  "6": "VI", "7": "VII", "8": "VIII", "9": "IX", "10": "X",
  "i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5",
  "vi": "6", "vii": "7", "viii": "8", "ix": "9", "x": "10"
};

const IMPERIAL_LEXICON = {
  // Combat, Rules & Enforcement
  "tk": ["teamkill", "team killing", "friendly fire", "fratricide", "combat regulations", "engagement", "lethal force"],
  "tking": ["teamkill", "team killing", "friendly fire", "fratricide", "combat regulations"],
  "rdm": ["random deathmatch", "unauthorized kill", "random killing", "assassination", "lethal force", "combat regulations"],
  "rdming": ["random deathmatch", "unauthorized kill", "random killing", "assassination"],
  "kos": ["kill on sight", "hostile status", "enemy of the state", "termination list", "combat engagement"],
  "aa": ["admin abuse", "abuse of power", "administrative misconduct", "officer misconduct", "power misuse"],
  "cuff": ["jailing", "detainment", "arrest", "custody", "restraints", "sentencing"],
  "cuffing": ["jailing", "detainment", "arrest", "custody", "restraints"],
  "jail": ["jailing", "detainment", "holding cell", "incarceration", "arrest", "custody", "sentencing"],
  "jailing": ["jailing", "detainment", "holding cell", "incarceration", "arrest", "custody"],
  "glitch": ["exploit", "bug abuse", "game mechanics abuse", "unauthorized modification"],
  "glitching": ["exploit", "bug abuse", "game mechanics abuse"],
  "exploit": ["exploit", "bug abuse", "game mechanics abuse"],
  "exploiting": ["exploit", "bug abuse", "game mechanics abuse"],
  "spawnkill": ["spawn killing", "spawn camping", "safezone breach", "combat regulations"],
  "spawncamp": ["spawn killing", "spawn camping", "safezone breach", "combat regulations"],
  "combatlog": ["combat logging", "quitting during combat", "evading punishment", "desertion"],
  "log": ["combat logging", "duty log", "shift log"],
  "duel": ["combat regulations", "dueling ring", "challenges", "honor duel", "kaggath"],
  "duels": ["combat regulations", "dueling ring", "challenges", "honor duel", "kaggath"],
  "dueling": ["combat regulations", "dueling ring", "challenges", "honor duel"],
  "disobey": ["insubordination", "chain of command", "treason", "officer directives", "dereliction of duty"],
  "insubordination": ["insubordination", "chain of command", "treason", "officer directives"],

  // Ranks & Hierarchy
  "fr": ["flat rank", "acolyte", "neophyte", "enlisted"],
  "lr": ["low rank", "acolyte", "neophyte", "enlisted", "initiate"],
  "mr": ["middle rank", "officer", "sith warrior", "sith inquisitor"],
  "hr": ["high rank", "overseer", "darth", "command"],
  "hc": ["high command", "military command", "lord"],
  "dc": ["dark council", "dark councilor", "sphere", "pyramid"],
  "pb": ["powerbase", "sovereign", "prestige", "house", "tier"],
  "ip": ["imperial policy", "statute", "decree", "code", "regulation"],

  // Divisions
  "dhg": ["dark honor guard", "emperor guard", "imperial guard", "royal guard"],
  "reavers": ["reavers", "assault division", "frontline", "vanguard"],
  "cots": ["children of the sith", "inquisitorius", "inquisitors", "shadows"],
  "dm": ["dread masters", "dread guard", "dread host"]
};

function extractSearchTokens(queryStr) {
  const clean = String(queryStr || "").toLowerCase().trim();
  const words = clean.split(/\s+/).filter(w => w && !["the", "a", "an", "for", "of", "in", "is", "can", "i", "we", "they", "to"].includes(w));
  const expanded = new Set(words);

  for (const word of words) {
    if (ROMAN_NUMERALS[word]) {
      expanded.add(ROMAN_NUMERALS[word].toLowerCase());
    }
    if (IMPERIAL_LEXICON[word]) {
      for (const term of IMPERIAL_LEXICON[word]) {
        term.split(/\s+/).forEach(t => expanded.add(t.toLowerCase()));
      }
    }
  }
  return Array.from(expanded);
}

function sanitizeQueryForSearch(raw) {
  let s = String(raw || "").toLowerCase();
  s = s.replace(/<@!?\d+>/g, "");
  s = s.replace(/\b(yo|lad|bro|hey|hi|hello|whats|what is|tell me|show me|find|search|about|holo|please|can you|the)\b/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

function formatLibraryDocument(doc, entries) {
  const articleHeading = doc.article_number
    ? `${doc.article_number}${doc.title ? `: ${doc.title}` : ""}`
    : (doc.title || "Imperial Document");

  let text = `[ARTICLE]: ${articleHeading}\n`;
  if (doc.library_key) text += `Scope: ${String(doc.library_key).toUpperCase()}\n`;
  if (doc.slug) text += `Slug: ${doc.slug}\n`;

  if (entries && entries.length > 0) {
    text += "\n--- CODIFIED REGULATIONS & SUB-SECTIONS (LIBRARY ENTRIES) ---\n";
    text += entries.map((e, idx) => {
      const heading = e.label || e.anchor || `Regulation ${idx + 1}`;
      let block = `### ${heading}\n${e.body || ""}`;
      if (Array.isArray(e.sub_clauses) && e.sub_clauses.length > 0) {
        block += "\n" + e.sub_clauses.map((sc, scIdx) => {
          if (typeof sc === "string") return `- **Sub-Section ${scIdx + 1}:** ${sc}`;
          const scLabel = sc.label || `Sub-Section ${scIdx + 1}`;
          const scBody = sc.body || sc.text || sc.content || JSON.stringify(sc);
          return `- **${scLabel}:** ${scBody}`;
        }).join("\n");
      }
      return block;
    }).join("\n\n");
  } else {
    text += "\n(No detailed regulations registered for this article)";
  }

  return text.trim();
}

let cachedLibraryDocs = null;
let lastLibraryCacheTime = 0;
const LIBRARY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getCachedLibraryDocuments() {
  const now = Date.now();
  if (cachedLibraryDocs && (now - lastLibraryCacheTime < LIBRARY_CACHE_TTL_MS)) {
    return cachedLibraryDocs;
  }

  try {
    const [documents, entries, statutes] = await Promise.all([
      supabaseRest("library_documents?select=id,library_key,slug,article_number,title,status,display_order&order=display_order.asc,created_at.asc").catch(() => []),
      supabaseRest("library_entries?select=id,document_id,anchor,label,body,sub_clauses,display_order&order=display_order.asc,created_at.asc").catch(() => []),
      supabaseRest("codex_statutes?is_published=eq.true&select=*").catch(() => [])
    ]);

    const docList = Array.isArray(documents) ? documents : [];
    const entryList = Array.isArray(entries) ? entries : [];
    const statuteList = Array.isArray(statutes) ? statutes : [];

    const entriesByDoc = new Map();
    const unmatchedEntries = [];

    for (const entry of entryList) {
      if (entry.document_id) {
        const list = entriesByDoc.get(entry.document_id) || [];
        list.push(entry);
        entriesByDoc.set(entry.document_id, list);
      } else {
        unmatchedEntries.push(entry);
      }
    }

    const allDocs = [];

    // 1. Process library_documents with mapped entries
    for (const doc of docList) {
      const docEntries = entriesByDoc.get(doc.id) || [];
      allDocs.push({
        id: doc.id,
        title: doc.title || "Imperial Document",
        libraryKey: doc.library_key || "General",
        articleNumber: doc.article_number || "",
        slug: doc.slug || "",
        status: doc.status || "PUBLISHED",
        entriesCount: docEntries.length,
        content: formatLibraryDocument(doc, docEntries),
        rawEntries: docEntries
      });
    }

    // 2. Process any standalone entries that didn't match a document ID
    for (const entry of unmatchedEntries) {
      allDocs.push({
        id: entry.id,
        title: entry.label || "Imperial Regulation",
        libraryKey: "general",
        articleNumber: "",
        slug: entry.anchor || entry.id,
        status: "PUBLISHED",
        entriesCount: 1,
        content: `[REGULATION]: ${entry.label || "Regulation"}\n${entry.body || ""}\n${Array.isArray(entry.sub_clauses) ? entry.sub_clauses.map(s => `- ${typeof s === "string" ? s : s.label ? `${s.label}: ${s.body}` : JSON.stringify(s)}`).join("\n") : ""}`.trim(),
        rawEntries: [entry]
      });
    }

    // 3. Process codex_statutes
    for (const st of statuteList) {
      let sectionsText = "";
      if (Array.isArray(st.sections)) {
        sectionsText = st.sections.map((s, i) => `### Section ${i + 1}: ${s.title || ""}\n${s.content || s.body || ""}`).join("\n\n");
      }
      allDocs.push({
        id: st.id,
        title: st.title || "Imperial Statute",
        libraryKey: "codex",
        articleNumber: "",
        slug: st.id,
        status: "PUBLISHED",
        entriesCount: Array.isArray(st.sections) ? st.sections.length : 1,
        content: `[IMPERIAL STATUTE / CODEX]: ${st.title}\nSummary: ${st.summary || ""}\n\n${sectionsText}`.trim(),
        rawEntries: []
      });
    }

    if (allDocs.length > 0) {
      cachedLibraryDocs = allDocs;
      lastLibraryCacheTime = now;
    }

    return allDocs;
  } catch (error) {
    console.error("[H.O.L.O AI API] Fatal getCachedLibraryDocuments error:", error);
    return cachedLibraryDocs || [];
  }
}

async function searchLibraryRegulations(queryStr, libraryKeyFilter) {
  const cleanQuery = sanitizeQueryForSearch(queryStr);
  const tokens = extractSearchTokens(cleanQuery);
  const allDocs = await getCachedLibraryDocuments();
  if (!allDocs.length) return [];

  let pool = allDocs;
  if (libraryKeyFilter && libraryKeyFilter !== "all" && libraryKeyFilter !== "general") {
    const subset = allDocs.filter(d => String(d.libraryKey).toLowerCase() === String(libraryKeyFilter).toLowerCase());
    if (subset.length > 0) {
      pool = subset;
    }
  }

  if (!cleanQuery && tokens.length === 0) {
    return pool.slice(0, 8);
  }

  const scored = pool.map(doc => {
    let score = 0;
    const titleLower = String(doc.title || "").toLowerCase();
    const articleLower = String(doc.articleNumber || "").toLowerCase();
    const slugLower = String(doc.slug || "").toLowerCase();
    const keyLower = String(doc.libraryKey || "").toLowerCase();
    const contentLower = String(doc.content || "").toLowerCase();

    if (cleanQuery && (titleLower === cleanQuery || articleLower === cleanQuery)) score += 300;
    else if (cleanQuery && (titleLower.includes(cleanQuery) || articleLower.includes(cleanQuery))) score += 150;
    else if (cleanQuery && slugLower.includes(cleanQuery)) score += 100;

    for (const token of tokens) {
      if (articleLower.includes(token)) score += 50;
      if (titleLower.includes(token)) score += 40;
      if (keyLower.includes(token)) score += 20;
      if (contentLower.includes(token)) score += 10;
    }

    // Granular scoring against linked library_entries regulations
    for (const entry of (doc.rawEntries || [])) {
      const entryLabel = String(entry.label || "").toLowerCase();
      const entryAnchor = String(entry.anchor || "").toLowerCase();
      const entryBody = String(entry.body || "").toLowerCase();
      const subClausesText = Array.isArray(entry.sub_clauses)
        ? entry.sub_clauses.map(sc => (typeof sc === "string" ? sc : sc.text || sc.content || sc.body || JSON.stringify(sc))).join(" ").toLowerCase()
        : "";

      for (const token of tokens) {
        if (entryLabel.includes(token)) score += 60;
        if (entryAnchor.includes(token)) score += 40;
        if (entryBody.includes(token)) score += 30;
        if (subClausesText.includes(token)) score += 25;
      }
    }

    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const topMatches = scored.filter(item => item.score > 0).map(item => item.doc);
  const selected = (topMatches.length > 0 ? topMatches : pool).slice(0, 3);
  
  return selected.map(d => ({
    article: d.articleNumber ? `${d.articleNumber}: ${d.title}` : d.title,
    scope: d.libraryKey,
    regulations: d.content
  }));
}

function toRomanNumeral(val) {
  const numerals = [[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let remaining = Number(val) || 0;
  let result = "";
  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }
  return result || String(val);
}

function toOrdinalSuffix(val) {
  const value = Number(val) || 0;
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  return `${value}${{ 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th"}`;
}

function parseEmperorQuery(queryStr = "") {
  const clean = String(queryStr).toLowerCase().trim();
  if (!clean) return { reigns: [], isCurrent: false };

  const isCurrent = /\b(current|present|now|active|latest|who\s*is\s*(?:the\s*)?emperor|present\s*emperor)\b/i.test(clean);

  const reigns = new Set();
  if (isCurrent) {
    reigns.add(41);
  }

  const ORDINAL_MAP = {
    first: 1, "1st": 1,
    second: 2, "2nd": 2,
    third: 3, "3rd": 3,
    fourth: 4, "4th": 4,
    fifth: 5, "5th": 5,
    sixth: 6, "6th": 6,
    seventh: 7, "7th": 7,
    eighth: 8, "8th": 8,
    ninth: 9, "9th": 9,
    tenth: 10, "10th": 10,
    eleventh: 11, "11th": 11,
    twelfth: 12, "12th": 12,
    thirteenth: 13, "13th": 13,
    fourteenth: 14, "14th": 14,
    fifteenth: 15, "15th": 15,
    sixteenth: 16, "16th": 16,
    seventeenth: 17, "17th": 17,
    eighteenth: 18, "18th": 18,
    nineteenth: 19, "19th": 19,
    twentieth: 20, "20th": 20,
    "twenty-first": 21, "twenty first": 21, "21st": 21,
    "twenty-second": 22, "twenty second": 22, "22nd": 22,
    "twenty-third": 23, "twenty third": 23, "23rd": 23,
    "twenty-fourth": 24, "twenty fourth": 24, "24th": 24,
    "twenty-fifth": 25, "twenty fifth": 25, "25th": 25,
    "twenty-sixth": 26, "twenty sixth": 26, "26th": 26,
    "twenty-seventh": 27, "twenty seventh": 27, "27th": 27,
    "twenty-eighth": 28, "twenty eighth": 28, "28th": 28,
    "twenty-ninth": 29, "twenty ninth": 29, "29th": 29,
    thirtieth: 30, "30th": 30,
    "thirty-first": 31, "thirty first": 31, "31st": 31,
    "thirty-second": 32, "thirty second": 32, "32nd": 32,
    "thirty-third": 33, "thirty third": 33, "33rd": 33,
    "thirty-fourth": 34, "thirty fourth": 34, "34th": 34,
    "thirty-fifth": 35, "thirty fifth": 35, "35th": 35,
    "thirty-sixth": 36, "thirty sixth": 36, "36th": 36,
    "thirty-seventh": 37, "thirty seventh": 37, "37th": 37,
    "thirty-eighth": 38, "thirty eighth": 38, "38th": 38,
    "thirty-ninth": 39, "thirty ninth": 39, "39th": 39,
    fortieth: 40, "40th": 40,
    "forty-first": 41, "forty first": 41, "41st": 41
  };

  const MULTI_ROMAN_MAP = {
    ii: 2, iii: 3, iv: 4, vi: 6, vii: 7, viii: 8, ix: 9,
    xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20,
    xxi: 21, xxii: 22, xxiii: 23, xxiv: 24, xxv: 25, xxvi: 26, xxvii: 27, xxviii: 28, xxix: 29, xxx: 30,
    xxxi: 31, xxxii: 32, xxxiii: 33, xxxiv: 34, xxxv: 35, xxxvi: 36, xxxvii: 37, xxxviii: 38, xxxix: 39, xl: 40, xli: 41
  };

  for (const [key, num] of Object.entries(ORDINAL_MAP)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(clean)) {
      reigns.add(num);
    }
  }

  const digitMatches = clean.matchAll(/\b(?:reign|emperor|number|#)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/gi);
  for (const match of digitMatches) {
    const val = Number(match[1]);
    if (val >= 1 && val <= 41) {
      reigns.add(val);
    }
  }

  const tokens = clean.split(/[\s,.-]+/);
  for (const token of tokens) {
    if (MULTI_ROMAN_MAP[token]) {
      reigns.add(MULTI_ROMAN_MAP[token]);
    }
  }

  const singleMatch = clean.match(/\b(?:reign|emperor|#|sovereign|the)\s+(i|v|x)\b/i);
  if (singleMatch) {
    const singleMap = { i: 1, v: 5, x: 10 };
    const num = singleMap[singleMatch[1].toLowerCase()];
    if (num) reigns.add(num);
  }

  return { reigns: Array.from(reigns), isCurrent };
}

async function searchAllArchives(queryStr) {
  const cleanQuery = sanitizeQueryForSearch(queryStr);
  const tokens = extractSearchTokens(cleanQuery);
  const parsedEmperor = parseEmperorQuery(cleanQuery);
  let results = [];

  // 1. Static Emperor Archive profiles from hierarchy.js
  const emperorItems = emperorArchiveItems();
  for (let i = 0; i < emperorItems.length; i++) {
    const emp = emperorItems[i];
    const index = i + 1;
    const roman = toRomanNumeral(index);
    const ordSuffix = toOrdinalSuffix(index);
    const isCurrent = Boolean(emp.current || emp.slug === "41st");
    const categoryName = emp.category || `The ${ordSuffix} Sith Emperor`;
    const pathName = emp.path || `The ${ordSuffix}`;

    const docContent = [
      `Sith Emperor Archive - Reign #${index} (${emp.name}) [Roman: ${roman}]`,
      `Title/Category: ${categoryName} (${pathName})`,
      `Status: ${isCurrent ? "CURRENT EMPEROR OF THE SITH EMPIRE (41st Sovereign)" : "Former Sovereign"}`,
      `Record: ${emp.body || "Biography pending archival upload."}`
    ].join("\n");

    results.push({
      id: emp.slug,
      title: emp.name,
      reignIndex: index,
      category: categoryName,
      summary: `${emp.name} — Reign #${index} (${categoryName})`,
      content: docContent,
      slug: emp.slug,
      isEmperorDoc: true,
      isCurrent
    });
  }

  // 2. Hierarchy items (High Command, Dark Council, Divisions)
  const hItems = hierarchyItems();
  for (const item of hItems) {
    results.push({
      id: item.slug,
      title: item.name,
      category: item.groupTitle || "Imperial Hierarchy",
      summary: item.summary || "",
      content: `${item.name} (${item.groupTitle || ""}): ${item.body || ""}`,
      slug: item.slug
    });
  }

  // 3. Database archive articles
  const dbArticles = await supabaseRest("archive_articles?select=*&limit=20").catch(() => []);
  for (const d of dbArticles) {
    results.push({
      id: d.id,
      title: d.title || d.name || "Untitled",
      category: d.category || "Imperial Archives",
      summary: d.summary || "",
      content: d.content || d.body || d.description || "",
      slug: d.slug || d.id
    });
  }

  // 4. Resource transmissions
  const transmissions = await supabaseRest("resource_transmissions?select=*&limit=10").catch(() => []);
  for (const t of transmissions) {
    results.push({
      id: t.id,
      title: t.title || t.subject || "Imperial Transmission",
      category: "Imperial Transmissions",
      summary: t.summary || "",
      content: `Transmission: ${t.title || ""}\n${t.content || t.body || ""}`,
      slug: t.id
    });
  }

  if (cleanQuery) {
    const targetReigns = new Set(parsedEmperor.reigns || []);

    const scored = results.map(doc => {
      let score = 0;
      const fullText = `${doc.title} ${doc.summary} ${doc.content} ${doc.category} ${doc.slug}`.toLowerCase();

      if (doc.isEmperorDoc && targetReigns.has(doc.reignIndex)) {
        score += 1000;
      }
      if (doc.isEmperorDoc && parsedEmperor.isCurrent && doc.isCurrent) {
        score += 1000;
      }
      if (doc.title.toLowerCase().includes(cleanQuery)) {
        score += 500;
      }
      if (fullText.includes(cleanQuery)) {
        score += 100;
      }
      if (tokens.length > 0) {
        const tokenHits = tokens.filter(t => fullText.includes(t)).length;
        score += tokenHits * 20;
      }
      return { doc, score };
    });

    const matched = scored.filter(s => s.score > 0);
    if (matched.length > 0) {
      matched.sort((a, b) => b.score - a.score);
      results = matched.map(m => m.doc);
    }
  }

  const seen = new Set();
  const uniqueDocs = results.filter(doc => {
    const key = doc.id || doc.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueDocs.slice(0, 4).map(r => ({
    title: r.title,
    category: r.category,
    summary: r.summary,
    content: r.content
  }));
}

function resolveTimeframeWindow(rawTimeframe) {
  let tf = String(rawTimeframe || "").toLowerCase().trim();
  // Strip conversational wrapper prefixes & suffixes
  tf = tf.replace(/^(who\s*(has|logged|has\s*the\s*most|is\s*the\s*top|had)?|top\s*(shifts?|performers?|users?|officers?|members?|time)?|most\s*time\s*(logged)?\s*(in|for|from|during)?|time\s*logged\s*(in|for|from|during)?|shifts?\s*(in|for|from|during)?|for|in|from|during|about|on)\s+/i, "").trim();
  tf = tf.replace(/\s+(report|reports|time|shifts?|logged|ago\s*report)$/i, "").trim();
  const clean = tf.replace(/[\s_-]+/g, " ");
  const now = new Date();

  // Helper for Monday calculation
  const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 1);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  };

  // 1. ALL TIME / EVER / OVERALL
  if (!clean || /^(all|ever|all\s*time|overall|total|history|historical|lifetime|entire)$/i.test(clean)) {
    return { type: "all_time", label: "all-time cumulative", isAllTime: true };
  }

  // 2. TODAY / 24H / YESTERDAY
  if (/^(today|now|daily|this\s*day)$/i.test(clean)) {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return { type: "today", startDate: start, endDate: now, label: "today", isLiveShiftsOnly: true };
  }
  if (/^(24h|24\s*hours|past\s*24\s*hours|last\s*24\s*hours)$/i.test(clean)) {
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return { type: "24h", startDate: start, endDate: now, label: "past 24 hours", isLiveShiftsOnly: true };
  }
  if (/^(yesterday)$/i.test(clean)) {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCHours(23, 59, 59, 999);
    return { type: "yesterday", startDate: start, endDate: end, label: "yesterday", isLiveShiftsOnly: true };
  }

  // 3. THIS / CURRENT (Week, Month, Year)
  if (/^(this\s*week|current\s*week|1\s*week|week|7\s*days|past\s*week)$/i.test(clean)) {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { type: "this_week", startDate: start, endDate: now, label: "this week (past 7 days)", isLiveShiftsOnly: true };
  }
  if (/^(this\s*month|current\s*month)$/i.test(clean)) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { type: "this_month", startDate: start, endDate: now, label: `this month (${start.toISOString().slice(0, 7)})`, isLiveShiftsOnly: false };
  }
  if (/^(this\s*year|current\s*year)$/i.test(clean)) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return { type: "this_year", startDate: start, endDate: now, label: `this year (${now.getUTCFullYear()})`, isLiveShiftsOnly: false };
  }

  // 4. LAST / PREVIOUS (Week, Month, Year)
  if (/^(last\s*week|prev(ious)?\s*week|1\s*week\s*ago)$/i.test(clean)) {
    const curMon = getMonday(now);
    const targetMon = new Date(curMon.getTime() - 7 * 24 * 60 * 60 * 1000);
    const targetSun = new Date(curMon.getTime() - 1);
    return {
      type: "discrete_past_week",
      weeksAgo: 1,
      targetWeekStart: targetMon.toISOString().slice(0, 10),
      startDate: targetMon,
      endDate: targetSun,
      label: `last week (week of ${targetMon.toISOString().slice(0, 10)})`,
      isSpecificReport: true
    };
  }
  if (/^(last\s*month|prev(ious)?\s*month|1\s*month\s*ago)$/i.test(clean)) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    return {
      type: "discrete_past_month",
      monthsAgo: 1,
      startDate: start,
      endDate: end,
      label: `last month (${start.toISOString().slice(0, 7)})`,
      isSpecificReport: false
    };
  }
  if (/^(last\s*year|prev(ious)?\s*year|1\s*year\s*ago)$/i.test(clean)) {
    const prevYear = now.getUTCFullYear() - 1;
    const start = new Date(Date.UTC(prevYear, 0, 1));
    const end = new Date(Date.UTC(prevYear, 11, 31, 23, 59, 59, 999));
    return {
      type: "discrete_past_year",
      yearsAgo: 1,
      startDate: start,
      endDate: end,
      label: `last year (${prevYear})`,
      isSpecificReport: false
    };
  }

  // 5. N WEEKS AGO (e.g. "2 weeks ago", "15 weeks ago", "3 weeks ago")
  const weeksAgoMatch = clean.match(/(\d+)\s*weeks?\s*ago/i);
  if (weeksAgoMatch) {
    const num = parseInt(weeksAgoMatch[1], 10);
    const curMon = getMonday(now);
    const targetMon = new Date(curMon.getTime() - num * 7 * 24 * 60 * 60 * 1000);
    const targetSun = new Date(targetMon.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    return {
      type: "discrete_past_week",
      weeksAgo: num,
      targetWeekStart: targetMon.toISOString().slice(0, 10),
      startDate: targetMon,
      endDate: targetSun,
      label: `${num} weeks ago (week of ${targetMon.toISOString().slice(0, 10)})`,
      isSpecificReport: true
    };
  }

  // 6. N MONTHS AGO (e.g. "3 months ago", "2 months ago")
  const monthsAgoMatch = clean.match(/(\d+)\s*months?\s*ago/i);
  if (monthsAgoMatch) {
    const num = parseInt(monthsAgoMatch[1], 10);
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - num, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - num + 1, 0, 23, 59, 59, 999));
    return {
      type: "discrete_past_month",
      monthsAgo: num,
      startDate: start,
      endDate: end,
      label: `${num} months ago (${start.toISOString().slice(0, 7)})`,
      isSpecificReport: false
    };
  }

  // 7. N YEARS AGO (e.g. "2 years ago")
  const yearsAgoMatch = clean.match(/(\d+)\s*years?\s*ago/i);
  if (yearsAgoMatch) {
    const num = parseInt(yearsAgoMatch[1], 10);
    const targetYear = now.getUTCFullYear() - num;
    const start = new Date(Date.UTC(targetYear, 0, 1));
    const end = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));
    return {
      type: "discrete_past_year",
      yearsAgo: num,
      startDate: start,
      endDate: end,
      label: `${num} years ago (${targetYear})`,
      isSpecificReport: false
    };
  }

  // 8. N DAYS AGO (e.g. "3 days ago", "5 days ago")
  const daysAgoMatch = clean.match(/(\d+)\s*days?\s*ago/i);
  if (daysAgoMatch) {
    const num = parseInt(daysAgoMatch[1], 10);
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - num);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCHours(23, 59, 59, 999);
    return {
      type: "discrete_past_day",
      daysAgo: num,
      startDate: start,
      endDate: end,
      label: `${num} days ago (${start.toISOString().slice(0, 10)})`,
      isLiveShiftsOnly: true
    };
  }

  // 9. PAST / LAST N (DAYS / WEEKS / MONTHS / YEARS) (e.g. "past 3 weeks", "last 30 days", "past 3 months", "last 2 years")
  const rollingMatch = clean.match(/(past|last)\s*(\d+)\s*(days?|weeks?|months?|years?|hours?)/i);
  if (rollingMatch) {
    const count = parseInt(rollingMatch[2], 10);
    const unit = rollingMatch[3].toLowerCase();
    let start;
    if (unit.startsWith("hour")) {
      start = new Date(now.getTime() - count * 60 * 60 * 1000);
    } else if (unit.startsWith("day")) {
      start = new Date(now.getTime() - count * 24 * 60 * 60 * 1000);
    } else if (unit.startsWith("week")) {
      start = new Date(now.getTime() - count * 7 * 24 * 60 * 60 * 1000);
    } else if (unit.startsWith("month")) {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count, now.getUTCDate()));
    } else if (unit.startsWith("year")) {
      start = new Date(Date.UTC(now.getUTCFullYear() - count, now.getUTCMonth(), now.getUTCDate()));
    }
    return {
      type: "rolling_range",
      startDate: start,
      endDate: now,
      label: `past ${count} ${unit}`,
      isLiveShiftsOnly: count <= 1 && unit.startsWith("week")
    };
  }

  // 10. SPECIFIC MONTH NAME + OPTIONAL YEAR (e.g. "August 2026", "July", "Jan 2025")
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const shortMonthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthRegex = new RegExp(`\\b(${monthNames.join("|")}|${shortMonthNames.join("|")})\\b(?:\\s*(\\d{4}))?`, "i");
  const monthMatch = clean.match(monthRegex);
  if (monthMatch) {
    const mStr = monthMatch[1].toLowerCase();
    let monthIdx = monthNames.findIndex(m => m.startsWith(mStr.slice(0, 3)));
    const yr = monthMatch[2] ? parseInt(monthMatch[2], 10) : now.getUTCFullYear();
    const start = new Date(Date.UTC(yr, monthIdx, 1));
    const end = new Date(Date.UTC(yr, monthIdx + 1, 0, 23, 59, 59, 999));
    return {
      type: "specific_month",
      startDate: start,
      endDate: end,
      label: `${monthNames[monthIdx]} ${yr}`,
      isSpecificReport: false
    };
  }

  // 11. SPECIFIC YEAR (e.g. "2025", "2026")
  const yearMatch = clean.match(/(\b20\d{2}\b)/);
  if (yearMatch && !clean.includes("-")) {
    const yr = parseInt(yearMatch[1], 10);
    const start = new Date(Date.UTC(yr, 0, 1));
    const end = new Date(Date.UTC(yr, 11, 31, 23, 59, 59, 999));
    return {
      type: "specific_year",
      startDate: start,
      endDate: end,
      label: `year ${yr}`,
      isSpecificReport: false
    };
  }

  // 12. SPECIFIC DATE (e.g. "2026-08-17", "week of 2026-08-17")
  const dateMatch = clean.match(/(\d{4}-\d{2}-\d{2})/i);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    const parsed = new Date(dateStr + "T00:00:00Z");
    if (!isNaN(parsed.getTime())) {
      const mon = getMonday(parsed);
      const sun = new Date(mon.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      return {
        type: "discrete_past_week",
        targetWeekStart: mon.toISOString().slice(0, 10),
        startDate: mon,
        endDate: sun,
        label: `week of ${mon.toISOString().slice(0, 10)}`,
        isSpecificReport: true
      };
    }
  }

  // DEFAULT / FALLBACK: All-time
  return { type: "all_time", label: "all-time cumulative", isAllTime: true };
}

async function executeToolCall(toolName, args, auth) {
  console.log(`[H.O.L.O AI Executing Tool] Function: ${toolName}`, args);
  try {
    if (toolName === "get_library_documents" || toolName === "get_statutes") {
      let queryStr = String(args.query || args.search || "").trim();
      if (["all", "list", "library", "documents", "ip", "imperial policy", "imperial policies", "policy", "policies", "rules", "regulations", "statutes", "*"].includes(queryStr.toLowerCase())) {
        queryStr = "";
      }
      const libraryKey = String(args.libraryKey || args.category || "").trim();
      const docs = await searchLibraryRegulations(queryStr, libraryKey);
      return docs.length ? docs : { message: `No Imperial library regulations or handbooks found matching '${queryStr || "all"}'.` };
    }

    if (toolName === "get_archives") {
      let queryStr = String(args.query || args.search || "").trim();
      if (["all", "list", "archives", "*"].includes(queryStr.toLowerCase())) {
        queryStr = "";
      }
      const docs = await searchAllArchives(queryStr);
      return docs.length ? docs : { message: `No archive articles found matching '${queryStr || "all"}'.` };
    }

    if (toolName === "get_powerbases") {
      let nameFilter = String(args.name || args.query || "").trim();
      if (["all", "any", "list", "*", "undefined", "null"].includes(nameFilter.toLowerCase())) {
        nameFilter = "";
      }

      let query = "powerbases?select=*,powerbase_members(*)&status=neq.DISSOLVED";
      if (nameFilter) {
        query += `&name=ilike.*${encodeURIComponent(nameFilter)}*`;
      }
      let powerbases = await supabaseRest(query).catch(() => []);
      if (!powerbases.length && nameFilter) {
        const allPbs = await supabaseRest("powerbases?select=*,powerbase_members(*)&status=neq.DISSOLVED").catch(() => []);
        powerbases = allPbs.filter(pb => 
          pb.name?.toLowerCase().includes(nameFilter.toLowerCase()) || 
          pb.description?.toLowerCase().includes(nameFilter.toLowerCase())
        );
        if (!powerbases.length && !nameFilter) {
          powerbases = allPbs;
        }
      }
      if (!powerbases.length && !nameFilter) {
        powerbases = await supabaseRest("powerbases?select=*,powerbase_members(*)").catch(() => []);
      }

      const allUserIds = new Set();
      (powerbases || []).forEach(pb => {
        if (pb.leader_id) allUserIds.add(String(pb.leader_id));
        (pb.powerbase_members || []).forEach(m => {
          if (m.user_id) allUserIds.add(String(m.user_id));
        });
      });

      const userMap = {};
      if (allUserIds.size > 0) {
        const idList = Array.from(allUserIds);
        const links = await supabaseRest(`verification_links?discord_user_id=in.(${idList.map(encodeURIComponent).join(",")})&select=discord_user_id,discord_username,roblox_username`).catch(() => []);
        (links || []).forEach(l => {
          userMap[l.discord_user_id] = l.roblox_username || l.discord_username || l.discord_user_id;
        });
      }

      const sortedPbs = (powerbases || []).sort((a, b) => (b.prestige || 0) - (a.prestige || 0));

      return {
        totalPowerbases: sortedPbs.length,
        powerbases: sortedPbs.slice(0, 8).map((pb, idx) => ({
          rank: idx + 1,
          name: pb.name,
          description: pb.description || "No description.",
          tier: pb.tier,
          prestige: pb.prestige,
          leaderName: userMap[pb.leader_id] || pb.leader_id || "Unknown",
          status: pb.status || "ACTIVE",
          memberCount: (pb.powerbase_members?.length || 0) + 1,
          members: (pb.powerbase_members || []).slice(0, 5).map(m => userMap[m.user_id] || m.user_id)
        }))
      };
    }

    if (toolName === "get_weekly_reports") {
      const scope = String(args.scope || args.division || "all").toLowerCase().trim();
      const weekStart = String(args.weekStart || args.week_start || "").trim();
      const targetUser = String(args.user || args.username || "").trim();
      const limit = Math.min(20, Math.max(1, Number(args.limit) || 5));

      let query = `division_weekly_reports?status=eq.published&select=*,division_weekly_report_members(*)&order=week_start.desc&limit=${limit}`;

      if (scope !== "all" && scope !== "*") {
        query += `&division_key=eq.${encodeURIComponent(scope)}`;
      }
      if (weekStart) {
        query += `&week_start=eq.${encodeURIComponent(weekStart)}`;
      }

      const reports = await supabaseRest(query).catch(() => []);

      if (!reports || reports.length === 0) {
        return { message: `No published weekly reports found for scope '${scope}'${weekStart ? ` and week_start '${weekStart}'` : ""}.` };
      }

      let robloxIdsToMatch = new Set();
      if (targetUser) {
        if (/^\d+$/.test(targetUser)) {
          robloxIdsToMatch.add(targetUser);
          const vLinks = await supabaseRest(`verification_links?discord_user_id=eq.${encodeURIComponent(targetUser)}&select=roblox_user_id&limit=1`).catch(() => []);
          if (vLinks?.[0]?.roblox_user_id) {
            robloxIdsToMatch.add(String(vLinks[0].roblox_user_id));
          }
        }
      }

      const formattedReports = reports.map(r => {
        let members = r.division_weekly_report_members || [];
        if (targetUser) {
          const lower = targetUser.toLowerCase();
          members = members.filter(m =>
            m.username?.toLowerCase().includes(lower) ||
            m.display_name?.toLowerCase().includes(lower) ||
            robloxIdsToMatch.has(String(m.roblox_id))
          );
        }

        const totalReportMinutes = (r.division_weekly_report_members || []).reduce((acc, m) => acc + (Number(m.hours) || 0) * 60 + (Number(m.minutes) || 0), 0);
        const totalEventsHosted = (r.division_weekly_report_members || []).reduce((acc, m) => acc + (Number(m.events_hosted) || 0), 0);
        const totalEventsAttended = (r.division_weekly_report_members || []).reduce((acc, m) => acc + (Number(m.events_attended) || 0), 0);

        return {
          reportId: r.id,
          divisionKey: r.division_key,
          weekStart: r.week_start,
          authorName: r.author_name,
          authorRobloxId: r.author_id,
          status: r.status,
          createdAt: r.created_at,
          totalReportHours: Math.round((totalReportMinutes / 60) * 10) / 10,
          totalEventsHosted,
          totalEventsAttended,
          totalMembersInReport: (r.division_weekly_report_members || []).length,
          members: members.slice(0, 15).map(m => ({
            robloxId: m.roblox_id,
            username: m.username,
            displayName: m.display_name,
            rank: m.rank,
            role: m.role,
            hours: m.hours,
            minutes: m.minutes,
            totalMinutes: (Number(m.hours) || 0) * 60 + (Number(m.minutes) || 0),
            eventsHosted: m.events_hosted || 0,
            eventsAttended: m.events_attended || 0
          }))
        };
      });

      return {
        totalReportsFound: reports.length,
        userFiltered: targetUser || null,
        reports: formattedReports
      };
    }

    if (toolName === "get_shift_totals") {
      const scope = args.scope || "all";
      const rankBracket = String(args.rankBracket || args.rank || args.bracket || "").toLowerCase().trim();
      const targetUser = String(args.user || args.username || "").trim();
      const timeframeInfo = resolveTimeframeWindow(args.timeframe || "");

      // Concurrently fetch all rank rosters and verification links
      const [allRosters, vLinks] = await Promise.all([
        fetchAllRankRosters().catch(() => ({})),
        supabaseRest("verification_links?select=discord_user_id,discord_username,roblox_user_id,roblox_username").catch(() => [])
      ]);

      const rankIndex = buildPersonnelRankIndex(allRosters);
      const discordToRobloxMap = new Map();
      for (const link of (vLinks || [])) {
        if (link.discord_user_id) {
          discordToRobloxMap.set(link.discord_user_id, {
            robloxId: link.roblox_user_id,
            robloxUsername: link.roblox_username,
            discordUsername: link.discord_username
          });
        }
      }

      const userAggregates = new Map();
      let totalCombinedSeconds = 0;
      let activeCount = 0;
      const now = Date.now();
      let reportWeekLabel = "";

      // 1. If timeframe targets a specific past week report (e.g. "2 weeks ago", "15 weeks ago", "last week", "week of YYYY-MM-DD")
      if (timeframeInfo.isSpecificReport && timeframeInfo.targetWeekStart) {
        let reportQuery = `division_weekly_reports?status=eq.published&select=*,division_weekly_report_members(*)&week_start=gte.${encodeURIComponent(timeframeInfo.targetWeekStart)}&week_start=lte.${encodeURIComponent(timeframeInfo.endDate.toISOString().slice(0, 10))}&order=week_start.desc`;
        if (scope !== "all" && scope !== "*") reportQuery += `&division_key=eq.${encodeURIComponent(scope)}`;

        let pastReports = await supabaseRest(reportQuery).catch(() => []);

        // Fallback: If no report matches that exact Monday, search for closest report on or before target end date
        if (!pastReports || pastReports.length === 0) {
          let fallbackQuery = `division_weekly_reports?status=eq.published&select=*,division_weekly_report_members(*)&week_start=lte.${encodeURIComponent(timeframeInfo.endDate.toISOString().slice(0, 10))}&order=week_start.desc&limit=${scope === "all" ? 6 : 1}`;
          if (scope !== "all" && scope !== "*") fallbackQuery += `&division_key=eq.${encodeURIComponent(scope)}`;
          pastReports = await supabaseRest(fallbackQuery).catch(() => []);
        }

        if (pastReports && pastReports.length > 0 && pastReports[0].week_start) {
          reportWeekLabel = ` (Week of ${pastReports[0].week_start})`;
        }

        for (const r of (pastReports || [])) {
          for (const m of (r.division_weekly_report_members || [])) {
            const memberSecs = Math.max(0, ((Number(m.hours) || 0) * 60 + (Number(m.minutes) || 0)) * 60);
            if (memberSecs <= 0 && !targetUser) continue;

            const userKey = m.roblox_id || m.username || "Unknown";
            const displayName = m.display_name || m.username || m.roblox_id || "Unknown";

            const existing = userAggregates.get(userKey) || {
              userId: userKey,
              name: displayName,
              robloxId: m.roblox_id || "",
              discordUsername: "",
              robloxUsername: m.username || "",
              totalSeconds: 0,
              shiftCount: 0,
              reportLoggedSeconds: 0,
              division: r.division_key,
              isActiveNow: false
            };

            existing.totalSeconds += memberSecs;
            existing.reportLoggedSeconds += memberSecs;
            if (m.username && existing.name === "Unknown") existing.name = m.username;

            userAggregates.set(userKey, existing);
            totalCombinedSeconds += memberSecs;
          }
        }
      }

      const userIndividualShifts = [];

      // 2. Query clock_shifts (live duty shifts) if not strictly an archived discrete past week report
      if (!timeframeInfo.isSpecificReport) {
        let query = "clock_shifts?select=id,discord_user_id,discord_username,roblox_user_id,roblox_username,duration_seconds,adjustment_seconds,status,scope,started_at,ended_at";
        if (scope !== "all" && scope !== "*") {
          query += `&scope=eq.${encodeURIComponent(scope)}`;
        }
        if (timeframeInfo.startDate) {
          query += `&started_at=gte.${encodeURIComponent(timeframeInfo.startDate.toISOString())}`;
        }
        if (timeframeInfo.endDate && !timeframeInfo.isAllTime) {
          query += `&started_at=lte.${encodeURIComponent(timeframeInfo.endDate.toISOString())}`;
        }
        if (targetUser) {
          const encoded = encodeURIComponent(targetUser);
          query += `&or=(discord_user_id.eq.${encoded},roblox_username.ilike.*${encoded}*,discord_username.ilike.*${encoded}*,roblox_user_id.eq.${encoded})`;
        }

        const shifts = await supabaseRest(query).catch(() => []);

        for (const s of (shifts || [])) {
          const isActive = s.status === "active";
          if (isActive) activeCount++;

          const baseSeconds = isActive
            ? Math.max(0, Math.floor((now - new Date(s.started_at).getTime()) / 1000))
            : Number(s.duration_seconds || 0);
          const shiftSecs = Math.max(0, baseSeconds + Number(s.adjustment_seconds || 0));

          totalCombinedSeconds += shiftSecs;

          const userKey = s.discord_user_id || s.roblox_user_id || s.roblox_username || s.discord_username || "Unknown";
          const displayName = s.roblox_username || s.discord_username || s.discord_user_id || s.roblox_user_id || "Unknown";

          const existing = userAggregates.get(userKey) || {
            userId: userKey,
            name: displayName,
            robloxId: s.roblox_user_id || "",
            discordUsername: s.discord_username || "",
            robloxUsername: s.roblox_username || "",
            totalSeconds: 0,
            shiftCount: 0,
            reportLoggedSeconds: 0,
            isActiveNow: false
          };

          existing.totalSeconds += shiftSecs;
          existing.shiftCount += 1;
          if (isActive) existing.isActiveNow = true;
          if (s.roblox_username && existing.name === "Unknown") existing.name = s.roblox_username;

          userAggregates.set(userKey, existing);

          if (targetUser) {
            const isMatch = (
              s.discord_user_id === targetUser ||
              s.roblox_user_id === targetUser ||
              s.roblox_username?.toLowerCase().includes(targetUser.toLowerCase()) ||
              s.discord_username?.toLowerCase().includes(targetUser.toLowerCase()) ||
              displayName.toLowerCase().includes(targetUser.toLowerCase())
            );
            if (isMatch) {
              userIndividualShifts.push({
                shiftId: s.id,
                scope: s.scope,
                status: s.status,
                startedAt: s.started_at,
                endedAt: s.ended_at || (isActive ? "Ongoing (Currently Active On Duty)" : null),
                durationHours: Math.round((shiftSecs / 3600) * 10) / 10,
                durationMinutes: Math.round(shiftSecs / 60),
                isActiveNow: isActive
              });
            }
          }
        }

        // 3. Include historical published weekly reports if timeframe spans historical windows (e.g. all_time, past_month, past_year, specific_year, specific_month)
        if (!timeframeInfo.isLiveShiftsOnly) {
          let reportQuery = "division_weekly_reports?status=eq.published&select=*,division_weekly_report_members(*)&order=week_start.desc";
          if (scope !== "all" && scope !== "*") reportQuery += `&division_key=eq.${encodeURIComponent(scope)}`;
          if (timeframeInfo.startDate && !timeframeInfo.isAllTime) {
            reportQuery += `&week_start=gte.${encodeURIComponent(timeframeInfo.startDate.toISOString().slice(0, 10))}`;
          }
          if (timeframeInfo.endDate && !timeframeInfo.isAllTime) {
            reportQuery += `&week_start=lte.${encodeURIComponent(timeframeInfo.endDate.toISOString().slice(0, 10))}`;
          }

          const pastReports = await supabaseRest(reportQuery).catch(() => []);

          for (const r of (pastReports || [])) {
            for (const m of (r.division_weekly_report_members || [])) {
              const memberSecs = Math.max(0, ((Number(m.hours) || 0) * 60 + (Number(m.minutes) || 0)) * 60);
              if (memberSecs <= 0 && !targetUser) continue;

              const userKey = m.roblox_id || m.username || "Unknown";
              const displayName = m.display_name || m.username || m.roblox_id || "Unknown";

              let matchedExistingKey = null;
              for (const [key, val] of userAggregates.entries()) {
                if (
                  key === String(m.roblox_id) ||
                  val.robloxUsername?.toLowerCase() === m.username?.toLowerCase() ||
                  val.name?.toLowerCase() === m.username?.toLowerCase()
                ) {
                  matchedExistingKey = key;
                  break;
                }
              }

              const targetKey = matchedExistingKey || userKey;
              const existing = userAggregates.get(targetKey) || {
                userId: targetKey,
                name: displayName,
                robloxId: m.roblox_id || "",
                discordUsername: "",
                robloxUsername: m.username || "",
                totalSeconds: 0,
                shiftCount: 0,
                reportLoggedSeconds: 0,
                isActiveNow: false
              };

              existing.totalSeconds += memberSecs;
              existing.reportLoggedSeconds = (existing.reportLoggedSeconds || 0) + memberSecs;
              if (m.username && existing.name === "Unknown") existing.name = m.username;

              userAggregates.set(targetKey, existing);
              totalCombinedSeconds += memberSecs;
            }
          }
        }
      }

      const rankedUsers = Array.from(userAggregates.values())
        .filter(u => u.totalSeconds > 0)
        .sort((a, b) => b.totalSeconds - a.totalSeconds)
        .map((u, index) => {
          const vLink = u.userId ? discordToRobloxMap.get(u.userId) : null;
          const robloxId = u.robloxId || vLink?.robloxId;
          const robloxUsername = u.robloxUsername || vLink?.robloxUsername;

          const rankMeta = (
            (robloxId && rankIndex.byRobloxId.get(String(robloxId))) ||
            (robloxUsername && rankIndex.byUsername.get(robloxUsername.toLowerCase())) ||
            (u.name && rankIndex.byDisplayName.get(u.name.toLowerCase())) ||
            (u.name && rankIndex.byUsername.get(u.name.toLowerCase())) ||
            null
          );

          return {
            rank: index + 1,
            name: u.name,
            robloxId: robloxId || rankMeta?.robloxId || "",
            robloxUsername: robloxUsername || rankMeta?.robloxUsername || u.name,
            discordUsername: u.discordUsername || vLink?.discordUsername || "",
            rankTitle: rankMeta?.primaryRankTitle || u.name,
            bracket: rankMeta?.bracketLabel || "Member",
            isMainHR: Boolean(rankMeta?.isMainHR),
            isDivHR: Boolean(rankMeta?.isDivHR),
            isAllHR: Boolean(rankMeta?.isAllHR),
            isDarkCouncil: Boolean(rankMeta?.isDarkCouncil),
            rankMeta: rankMeta || null,
            totalHours: Math.round((u.totalSeconds / 3600) * 10) / 10,
            totalMinutes: Math.round(u.totalSeconds / 60),
            shiftCount: u.shiftCount,
            reportLoggedHours: Math.round(((u.reportLoggedSeconds || 0) / 3600) * 10) / 10,
            onDutyNow: u.isActiveNow
          };
        });

      const targetRankFilter = rankBracket || (scope === "highranks" ? "hr" : "");
      let rankStatistics = null;
      let displayRankedUsers = rankedUsers;

      if (targetRankFilter) {
        rankStatistics = computeRankBracketStatistics(
          rankedUsers,
          rankIndex,
          targetRankFilter,
          `${timeframeInfo.label}${reportWeekLabel}`
        );
        displayRankedUsers = rankedUsers.filter(u => matchesRankFilter(u.rankMeta, targetRankFilter));
      } else {
        rankStatistics = computeRankBracketStatistics(
          rankedUsers,
          rankIndex,
          "all_hr",
          `${timeframeInfo.label}${reportWeekLabel}`
        );
      }

      // Sanitize leaderboard to minimum essential tokens
      const sanitizedLeaderboard = displayRankedUsers.slice(0, 10).map(u => ({
        rank: u.rank,
        name: u.name,
        rankTitle: u.rankTitle,
        totalHours: u.totalHours,
        shiftCount: u.shiftCount,
        onDutyNow: u.onDutyNow
      }));

      // Omit bulky inactive list from LLM context (summary has count + sample)
      if (rankStatistics && rankStatistics.inactiveOfficers) {
        delete rankStatistics.inactiveOfficers;
      }

      const topUser = sanitizedLeaderboard[0] || null;

      const matchedUser = targetUser ? (rankedUsers.find(u =>
        u.name.toLowerCase().includes(targetUser.toLowerCase()) ||
        u.robloxId === targetUser ||
        u.robloxUsername?.toLowerCase().includes(targetUser.toLowerCase()) ||
        u.discordUsername?.toLowerCase().includes(targetUser.toLowerCase())
      ) || null) : null;

      const activeShift = userIndividualShifts.find(s => s.isActiveNow) || null;
      const compactShifts = userIndividualShifts
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
        .slice(0, 3)
        .map(s => ({ scope: s.scope, startedAt: s.startedAt, hours: s.durationHours, active: s.isActiveNow }));

      const userQueryResult = targetUser ? (matchedUser ? {
        name: matchedUser.name,
        rankTitle: matchedUser.rankTitle,
        totalHours: matchedUser.totalHours,
        shiftCount: matchedUser.shiftCount,
        currentlyOnDuty: Boolean(matchedUser.onDutyNow || activeShift),
        activeShift: activeShift ? { scope: activeShift.scope, startedAt: activeShift.startedAt, hours: activeShift.durationHours } : null,
        recentShifts: compactShifts
      } : {
        query: targetUser,
        message: "No recorded shift or report logs found."
      }) : null;

      return {
        scope,
        rankBracket: targetRankFilter || "all",
        timeframe: `${timeframeInfo.label}${reportWeekLabel}`,
        totalUsers: targetRankFilter ? displayRankedUsers.length : userAggregates.size,
        totalHours: targetRankFilter && rankStatistics ? rankStatistics.totalHoursLogged : Math.round((totalCombinedSeconds / 3600) * 10) / 10,
        activeShiftsCount: activeCount,
        topUser: topUser ? { name: topUser.name, rankTitle: topUser.rankTitle, hours: topUser.totalHours } : null,
        leaderboardTop10: sanitizedLeaderboard,
        rankStatistics,
        userQuery: userQueryResult
      };
    }

    if (toolName === "get_division_activity") {
      const div = String(args.division || "").toLowerCase().trim();
      const [roster, reports, inspections] = await Promise.all([
        fetchDivisionRoster(div).catch(() => []),
        supabaseRest(`division_weekly_reports?division_key=eq.${encodeURIComponent(div)}&select=*,division_weekly_report_members(*)&order=created_at.desc&limit=3`).catch(() => []),
        supabaseRest(`division_inspections?division_key=eq.${encodeURIComponent(div)}&select=*,division_inspection_sections(*)&order=created_at.desc&limit=3`).catch(() => [])
      ]);

      return {
        division: div,
        rosterCount: roster.length,
        roster: roster.slice(0, 20),
        recentWeeklyReports: (reports || []).map(r => ({
          id: r.id,
          weekStart: r.week_start,
          authorName: r.author_name,
          status: r.status,
          memberReportsCount: r.division_weekly_report_members?.length || 0,
          members: (r.division_weekly_report_members || []).slice(0, 10)
        })),
        recentInspections: (inspections || []).map(i => ({
          id: i.id,
          heldOn: i.held_on,
          authorName: i.author_name,
          overallScore: i.overall_score,
          bonusPercentage: i.bonus_percentage,
          notes: i.notes
        }))
      };
    }

    if (toolName === "get_council_floor") {
      const proposals = await supabaseRest("council_proposals?select=*,council_votes(*)&order=created_at.desc&limit=5").catch(() => []);
      return {
        totalProposals: (proposals || []).length,
        proposals: (proposals || []).map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          proposalType: p.proposal_type,
          status: p.status,
          authorName: p.author_name || p.author_roblox_username || "Unknown",
          createdAt: p.created_at,
          votesCount: p.council_votes?.length || 0,
          votesSummary: (p.council_votes || []).reduce((acc, v) => {
            const vote = String(v.vote || "").toLowerCase();
            if (vote === "yes" || vote === "aye") acc.yes = (acc.yes || 0) + 1;
            else if (vote === "no" || vote === "nay") acc.no = (acc.no || 0) + 1;
            else acc.abstain = (acc.abstain || 0) + 1;
            return acc;
          }, { yes: 0, no: 0, abstain: 0 })
        }))
      };
    }

    if (toolName === "get_timeline") {
      const clean = sanitizeQueryForSearch(args.query || "");
      let query = "group_timeline_entries?select=*&order=display_order.asc&limit=15";
      if (clean) {
        query += `&or=(title.ilike.*${encodeURIComponent(clean)}*,body.ilike.*${encodeURIComponent(clean)}*)`;
      }
      const entries = await supabaseRest(query).catch(() => []);
      return {
        entries: entries.slice(0, 10)
      };
    }

    if (toolName === "lookup_roblox_user" || toolName === "lookup_personnel") {
      const queryStr = String(args.query || args.username || "").trim();
      if (!queryStr) return { error: "No query or username provided." };

      let robloxUser = await resolveUserByUsername(queryStr).catch(() => null);

      if (!robloxUser?.id) {
        const isNumeric = /^\d+$/.test(queryStr);
        const encoded = encodeURIComponent(queryStr);
        const query = isNumeric
          ? `users?or=(roblox_username.ilike.*${encoded}*,discord_id.eq.${encoded})&select=id,roblox_username,discord_id&limit=1`
          : `users?roblox_username=ilike.*${encoded}*&select=id,roblox_username,discord_id&limit=1`;

        const dbUsers = await supabaseRest(query).catch(() => []);

        if (dbUsers && dbUsers[0]?.roblox_username) {
          robloxUser = await resolveUserByUsername(dbUsers[0].roblox_username).catch(() => null);
        } else if (dbUsers && dbUsers[0]?.id) {
          robloxUser = { id: dbUsers[0].id, name: dbUsers[0].roblox_username || queryStr };
        }
      }

      let profileData = null;
      if (robloxUser?.id) {
        try {
          const { user, groups, accountAgeDays, friendsCount, badgeCount } = await loadRobloxProfileSummary(robloxUser.id);
          const mainGroupMembership = (groups.data || []).find(
            membership => membership?.group?.id === ROBLOX_GROUPS.MAIN_GROUP.groupId
          );
          const divisionMemberships = Object.entries(ROBLOX_GROUPS.DIVISIONS)
            .map(([divisionKey, definition]) => {
              const membership = (groups.data || []).find(item => item?.group?.id === definition.groupId);
              if (!membership) return null;
              return {
                division: definition.label || divisionKey,
                rankName: membership.role?.name || "Unknown",
                rank: membership.role?.rank || 0,
                joinedAt: membership.joinedAt || membership.joined_at || null
              };
            })
            .filter(Boolean);

          const warnings = personnelLookupWarnings({ accountAgeDays, friendsCount, badgeCount });

          profileData = {
            robloxId: String(robloxUser.id),
            username: robloxUser.name || queryStr,
            displayName: user.displayName || robloxUser.displayName || robloxUser.name,
            created: user.created || null,
            accountAgeDays,
            friendsCount,
            badgeCount,
            profileUrl: `https://www.roblox.com/users/${robloxUser.id}/profile`,
            mainGroupRank: mainGroupMembership ? `${mainGroupMembership.role?.name} (Rank ${mainGroupMembership.role?.rank})` : "Not in Sith Order main group",
            divisionRanks: divisionMemberships,
            warnings: warnings.map(w => `${w.label}: ${w.detail}`)
          };
        } catch (e) {
          profileData = { robloxId: String(robloxUser.id), username: robloxUser.name, error: e.message };
        }
      }

      const targetRobloxId = robloxUser?.id ? String(robloxUser.id) : (/^\d+$/.test(queryStr) ? queryStr : "");
      const targetQuery = targetRobloxId ? encodeURIComponent(targetRobloxId) : encodeURIComponent(queryStr);
      const encoded = encodeURIComponent(queryStr);

      const [dbUsers, discordUsers, links, shiftLogs] = await Promise.all([
        supabaseRest(/^\d+$/.test(queryStr)
          ? `users?or=(roblox_username.ilike.*${encoded}*,discord_id.eq.${encoded})&select=id,roblox_username,discord_id&limit=3`
          : `users?roblox_username=ilike.*${encoded}*&select=id,roblox_username,discord_id&limit=3`
        ).catch(() => []),
        supabaseRest(/^\d+$/.test(queryStr)
          ? `discord_users?or=(username.ilike.*${encoded}*,id.eq.${encoded})&select=id,username,global_name&limit=3`
          : `discord_users?username=ilike.*${encoded}*&select=id,username,global_name&limit=3`
        ).catch(() => []),
        targetRobloxId || /^\d+$/.test(queryStr)
          ? supabaseRest(`verification_links?or=(discord_user_id.eq.${encoded},roblox_user_id.eq.${targetQuery})&select=roblox_user_id,discord_user_id,created_at&limit=3`).catch(() => [])
          : Promise.resolve([]),
        supabaseRest(`clock_shifts?or=(roblox_username.ilike.*${encoded}*,discord_username.ilike.*${encoded}*)&select=discord_user_id,discord_username,roblox_user_id,roblox_username&limit=3`).catch(() => [])
      ]);

      if (!profileData && !dbUsers.length && !discordUsers.length && !links.length && !shiftLogs.length) {
        return { message: `No personnel record matching '${queryStr}' found in the archives.` };
      }

      return {
        robloxProfile: profileData,
        databaseUsers: dbUsers,
        discordUsers: discordUsers,
        verificationLinks: links,
        recentShiftRecords: shiftLogs
      };
    }

    return { error: `Tool ${toolName} is not recognized.` };
  } catch (err) {
    return { error: `Tool execution error: ${err.message}` };
  }
}

function parseXmlToolCalls(choiceMessage) {
  if (!choiceMessage?.content) return;
  const contentStr = choiceMessage.content;

  if (contentStr.includes("<tool_call>") || contentStr.includes("<function=")) {
    choiceMessage.tool_calls = choiceMessage.tool_calls || [];

    const blocks = contentStr.match(/<tool_call>[\s\S]*?<\/tool_call>/g) || [contentStr];
    for (const block of blocks) {
      const funcMatch = block.match(/<function=([^>]+)>/) || block.match(/<name>([^<]+)<\/name>/);
      if (funcMatch) {
        const fnName = funcMatch[1].trim();
        let fnArgs = {};
        const paramRegex = /<parameter=([^>]+)>([\s\S]*?)<\/parameter>/g;
        let pMatch;
        while ((pMatch = paramRegex.exec(block)) !== null) {
          fnArgs[pMatch[1].trim()] = pMatch[2].trim();
        }
        choiceMessage.tool_calls.push({
          id: "call_" + Math.random().toString(36).substr(2, 9),
          type: "function",
          function: { name: fnName, arguments: JSON.stringify(fnArgs) }
        });
      }
    }

    choiceMessage.content = contentStr
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
      .replace(/<function=[^>]+>[\s\S]*?<\/function>/g, "")
      .replace(/<[\/]?tool_call>/g, "")
      .trim();
  }
}

export async function POST(req) {
  try {
    const auth = await getAuthContext(req, { optional: true });

    const body = await req.json().catch(() => ({}));
    const userMessages = Array.isArray(body.messages) ? body.messages : [];

    const apiKey = String(process.env.GROQ_API_TOKEN || "").trim();

    if (!apiKey) {
      return NextResponse.json({
        role: "assistant",
        content: "TRANSMISSION ERROR: Subspace AI communications channel unconfigured (GROQ_API_TOKEN missing)."
      }, { status: 500 });
    }

    const activeUser = auth?.user || {};
    const activeProfile = auth?.profile || {};
    const activeName = activeUser.username || activeProfile.robloxId || "User";
    const discordId = String(activeUser.discord_id || activeProfile.discordId || auth?.discordId || "");
    const isExemptUser = EXEMPT_USER_IDS.has(discordId);

    const systemPromptWithContext = buildSystemPrompt(isExemptUser, activeName, discordId);

    let messages = [
      { role: "system", content: systemPromptWithContext },
      ...userMessages.slice(-4).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.content || "").slice(0, 350)
      }))
    ];

    let iterations = 0;
    let finalContent = "";

    while (iterations < 5) {
      iterations++;

      const result = await executeGroqChat(apiKey, {
        messages,
        tools: OVERSEER_TOOLS,
        tool_choice: "auto"
      });

      if (!result.ok) {
        const errInfo = result.error;
        console.error("[H.O.L.O AI Error]:", errInfo);
        if (errInfo?.status === 429 || String(errInfo?.body || "").includes("rate_limit")) {
          const secondsMatch = String(errInfo.body || "").match(/try again in ([\d\.]+\s*s(?:econds)?|[\d\.]+\s*m(?:inutes)?)/i);
          const timeStr = secondsMatch ? secondsMatch[1] : "a few seconds";
          return NextResponse.json({
            role: "assistant",
            content: `Holonet archive rate limit reached. Try again in ${timeStr}.`
          });
        }
        return NextResponse.json({
          role: "assistant",
          content: `TRANSMISSION ERROR: Holonet archive request returned error ${errInfo?.status || 500}.`
        }, { status: 500 });
      }

      const choiceMessage = result.data.choices?.[0]?.message;
      if (!choiceMessage) break;

      parseXmlToolCalls(choiceMessage);

      if (choiceMessage.tool_calls && choiceMessage.tool_calls.length > 0) {
        messages.push(choiceMessage);

        for (const toolCall of choiceMessage.tool_calls) {
          const fnName = toolCall.function?.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(toolCall.function?.arguments || "{}");
          } catch { }

          const toolResult = await executeToolCall(fnName, fnArgs, auth);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: fnName,
            content: JSON.stringify(toolResult)
          });
        }
        continue;
      }

      finalContent = String(choiceMessage.content || "")
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
        .replace(/<function=[^>]+>[\s\S]*?<\/function>/g, "")
        .replace(/<[\/]?tool_call>/g, "")
        .replace(/<[\/]?parameter>/g, "")
        .trim();

      break;
    }

    if (isExemptUser) {
      finalContent = finalContent.replace(/\[NO_RESPONSE\]/gi, "").trim();
      if (!finalContent) {
        finalContent = "Transmission acknowledged, My Lord. How may H.O.L.O assist you?";
      }
    }

    return NextResponse.json({
      role: "assistant",
      content: finalContent || "HOLONET NOTICE: Query logged. No records returned."
    });

  } catch (error) {
    console.error("AI Chat handler error:", error);
    return NextResponse.json({
      role: "assistant",
      content: `INTERNAL ERROR: Subspace transmission processing failed: ${error.message}`
    }, { status: 500 });
  }
}
