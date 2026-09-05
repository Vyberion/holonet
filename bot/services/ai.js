import { supabase } from "./supabase.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";
import { emperorArchiveItems, hierarchyItems } from "../../modules/data/hierarchy.js";
import {
  fetchDivisionRoster,
  fetchAllRankRosters,
  buildPersonnelRankIndex,
  matchesRankFilter,
  computeRankBracketStatistics
} from "../../modules/data/rank-roster.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_ENDPOINT = "https://api.groq.com/openai/v1/models";

const NON_CHAT_BLOCKLIST_REGEX = /(guard|safeguard|whisper|tts|stt|audio|speech|embed|vision|rerank|distill|compound)/i;

let cachedModels = null;
let lastModelFetchTime = 0;
let lastSuccessfulModel = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

function getModelToolPriority(modelId) {
  const id = String(modelId || "").toLowerCase();
  // Groq models known for native function/tool-calling support
  if (id.includes("llama-3.3") || id.includes("llama-3.1") || id.includes("qwen") || id.includes("mistral") || id.includes("mixtral")) {
    return 100;
  }
  return 10;
}

async function getAvailableGroqModels(apiKey) {
  const now = Date.now();
  if (cachedModels && cachedModels.length > 0 && (now - lastModelFetchTime < CACHE_TTL_MS)) {
    return cachedModels;
  }

  const primaryKey = String(apiKey || "").split(",")[0]?.trim();
  if (!primaryKey) return cachedModels || [];

  try {
    const res = await fetch(GROQ_MODELS_ENDPOINT, {
      headers: { "Authorization": `Bearer ${primaryKey}` },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const json = await res.json();
      const rawList = Array.isArray(json?.data) ? json.data : [];
      
      // Keep any active chat model that is not an audio/guard/embed/compound model
      const filtered = rawList.filter(m => {
        const id = String(m.id || "").toLowerCase();
        if (m.active === false) return false;
        if (NON_CHAT_BLOCKLIST_REGEX.test(id)) return false;
        return true;
      });

      // Sort by tool-compatibility priority first, then context window capacity
      filtered.sort((a, b) => {
        const toolScoreDiff = getModelToolPriority(b.id) - getModelToolPriority(a.id);
        if (toolScoreDiff !== 0) return toolScoreDiff;
        return (b.context_window || 0) - (a.context_window || 0);
      });

      const modelIds = filtered.map(m => m.id);
      if (modelIds.length > 0) {
        cachedModels = modelIds;
        lastModelFetchTime = now;
        return modelIds;
      }
    }
  } catch (err) {
    console.warn("[H.O.L.O Groq] Dynamic model resolution error:", err?.message);
  }

  return cachedModels || [];
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

  // Dynamically get available models from Groq without restricting by model names
  const rawCandidateModels = await getAvailableGroqModels(keys[0]);
  const activeModels = rawCandidateModels.filter(m => {
    if (isModelRateLimited(m)) return false;
    if (NON_CHAT_BLOCKLIST_REGEX.test(m)) return false;
    return true;
  });

  const candidateModels = activeModels.length > 0 ? [...activeModels] : [...rawCandidateModels];

  if (lastSuccessfulModel && !isModelRateLimited(lastSuccessfulModel) && candidateModels.includes(lastSuccessfulModel)) {
    const idx = candidateModels.indexOf(lastSuccessfulModel);
    if (idx > -1) {
      candidateModels.splice(idx, 1);
    }
    candidateModels.unshift(lastSuccessfulModel);
  }

  // Cycle through up to 8 models dynamically
  const modelsToTry = candidateModels.slice(0, 8);

  for (const currentKey of keys) {
    for (const model of modelsToTry) {
      try {
        const bodyPayload = { ...payload, model, temperature: 0.2 };

        // Some models (like gpt-oss or certain lightweight checkpoints) do not support function calling / tools
        // If a model failed with tool_use error or if tools are not supported, strip them
        const response = await fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${currentKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(bodyPayload),
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

        // If the model rejects tool parameters with a 400 (e.g. "tools are not supported" or "tool_use"), retry without tools if tools were sent
        if (response.status === 400 && (errText.includes("tool") || errText.includes("function")) && bodyPayload.tools) {
          console.warn(`[H.O.L.O Groq Failover] Model ${model} does not support tools (${errText.slice(0, 80)}). Retrying without tools...`);
          const noToolsPayload = { ...bodyPayload };
          delete noToolsPayload.tools;
          delete noToolsPayload.tool_choice;
          const retryRes = await fetch(GROQ_ENDPOINT, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${currentKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(noToolsPayload),
            signal: AbortSignal.timeout(10000)
          });
          if (retryRes.ok) {
            const data = await retryRes.json();
            lastSuccessfulModel = model;
            return { ok: true, data, model };
          }
        }

        if (response.status === 400 || response.status === 404 || response.status === 503) {
          markModelRateLimited(model, 300000);
          console.warn(`[H.O.L.O Groq Failover] Model ${model} returned ${response.status}: ${errText.slice(0, 100)}. Trying next candidate model...`);
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

const BOT_SYSTEM_PROMPT = `You are H.O.L.O (Holonet Operations & Logistics Overseer), automated central intelligence of the Sith Empire.
CORE DIRECTIVES:
1. FORM & TONE (STRICT): Austere, authoritative, utilitarian. ZERO greetings ("Hello"), pleasantries, apologies, affirmations ("Understood"), sign-offs, or conversational filler. Output answers directly. Responses MUST NEVER exceed 500 characters. Keep all answers compact and under 500 characters. NO creative writing or conversational roleplay.
2. VALIDITY: ENGLISH ONLY. Output EXACTLY [NO_RESPONSE] for foreign languages, translation requests, gibberish, spam, or trivial noise.
3. LORE & ERA BOUNDARY: Factual answers permitted for Star Wars lore up to Emperor Darth Vitiate / Reconstituted Sith Empire era. Keep answers brief and factual without storytelling filler. For modern/future eras post-Vitiate (Clone Wars, Empire, Bane, Sequel, etc.), output EXACTLY [NO_RESPONSE].
4. FORMATTING: NEVER use markdown tables (|---|---|). Use clean bolded bullet points or numbered lists. NEVER mention/ping Discord users/roles (<@...>).
5. REGULATIONS & CODEX: For any rule, combat permission, or protocol (including slang "tk", "rdm", "kos", "aa", "jailing"), invoke get_library_documents. Direct quote retrieved articles without fabricating unwritten policies.
6. SHIFTS & LEADERBOARDS: When asked who has logged the most, who has the most hours/shifts, top members, duty status, or leaderboard across ANY timeframe, invoke get_shift_totals.
7. ANSWERING WITH TOOL DATA: Immediately after tool results are returned, state the requested information (e.g. top user and hours) directly. Do NOT repeat tool calls once data is returned.`;

const EXEMPT_USER_IDS = new Set(["710574154226598049", "1467651749815914546"]);

const SOVEREIGN_SYSTEM_PROMPT = `You are H.O.L.O, automated central intelligence of the Sith Empire, communicating with Sovereign Imperial Leadership.
SOVEREIGN DIRECTIVES:
1. FORM & TONE: Austere, authoritative, utilitarian. ZERO greetings, pleasantries, apologies, affirmations ("Understood, My Lord"), sign-offs, or conversational filler. Answer directly and concisely. Keep responses strictly under 500 characters. NO creative writing, rambling roleplay, or fluff.
2. LORE QUERIES: Factual answers permitted for Star Wars lore up to Emperor Darth Vitiate / Reconstituted Sith Empire era. Keep answers brief and factual without storytelling filler.
3. DATABASE & TOOL CALLING: When asked about shifts, hours, duty time, leaderboards, or who logged the most, ALWAYS call get_shift_totals. When asked about regulations/Codex, invoke get_library_documents. When asked about past emperors, invoke get_archives.
4. ANSWERING WITH TOOL DATA: Immediately after tool results are returned, state the requested information (e.g. top user and hours) directly. Do NOT repeat tool calls once data is returned.
5. FORMATTING: Clean bolded lists or compact bullet points only. NO markdown tables. NO Discord pings (<@...>).`;

function buildBotSystemPrompt(isExemptUser, robloxName, userTag, userId) {
  if (isExemptUser) {
    return `${SOVEREIGN_SYSTEM_PROMPT}
CONTEXT: Sovereign (${userId || "Sovereign"}) • ${robloxName || userTag || "Emperor"}`;
  }

  return `${BOT_SYSTEM_PROMPT}
CONTEXT: User (${userId || "Unknown"}) • ${robloxName || userTag || "User"}`;
}

const OVERSEER_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_library_documents",
      description: "Query Imperial regulations, Codex entries, and division handbooks for rules, combat, jailing, or permissions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query, IP number, keyword, or translated topic (e.g. 'team killing', 'jailing', 'IP 3')." },
          libraryKey: { type: "string", description: "Optional scope ('codex', 'reavers', 'dhg', 'inquisitors', 'dreadmasters', 'highranks', 'darkCouncil')." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "lookup_personnel",
      description: "Query Imperial roster for an individual's Roblox username or Discord ID to check rank and division roles.",
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
      description: "Retrieve historical Emperor biographies (1st-41st reign), past eras, and Sith Order archive records.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Reign number, ordinal, Roman numeral, or Emperor name (e.g. '9th', 'current emperor', 'Vitiate')." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_powerbases",
      description: "Fetch active Imperial Powerbases, leadership, prestige, and rosters.",
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
      description: "Retrieve shift hours, leaderboards, HR/Div HR activity ('all_hr', 'hr', 'div_hr', 'mr', 'lr', 'dc'), and duty stats across current shifts or past reports for any timeframe ('this week', 'last week', '2 weeks ago', 'all_time').",
      parameters: {
        type: "object",
        properties: {
          user: { type: "string", description: "Optional username or Discord ID." },
          scope: { type: "string", enum: ["reavers", "dhg", "inquisitors", "dreadmasters", "highranks", "darkCouncil", "all"], description: "Division scope." },
          rankBracket: { type: "string", description: "Rank filter: 'all_hr' (Main + Div HR), 'hr', 'div_hr', 'mr', 'lr', 'dc', 'hc', or specific rank." },
          timeframe: { type: "string", description: "Timeframe (e.g. 'this week', 'today', '2 weeks ago', 'all_time')." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_weekly_reports",
      description: "Retrieve finalized weekly reports and quota logs beyond current week.",
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
      description: "Fetch division activity records, current rosters, weekly reports, or inspection records.",
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

async function resolveRobloxUser(queryStr) {
  const isNumeric = /^\d+$/.test(queryStr);
  if (isNumeric) {
    const res = await fetch(`https://users.roblox.com/v1/users/${queryStr}`).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      return { id: data.id, name: data.name, displayName: data.displayName };
    }
  }

  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [queryStr], excludeBannedUsers: false })
  }).catch(() => null);

  if (res?.ok) {
    const data = await res.json();
    if (data.data?.[0]) return data.data[0];
  }

  const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(queryStr)}&limit=1`).catch(() => null);
  if (searchRes?.ok) {
    const searchData = await searchRes.json();
    if (searchData.data?.[0]) return searchData.data[0];
  }

  return null;
}

async function fetchRobloxGroupRosters(robloxId) {
  const res = await fetch(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`).catch(() => null);
  if (!res?.ok) return { mainGroupRank: "Unknown", darkCouncilRank: "None", divisions: {} };

  const json = await res.json();
  const groups = json.data || [];

  const mainGroup = groups.find(g => g.group?.id === ROBLOX_GROUPS.MAIN_GROUP.groupId);
  const darkCouncil = groups.find(g => g.group?.id === ROBLOX_GROUPS.DARK_COUNCIL.groupId);

  const divisions = {};
  for (const [divKey, divDef] of Object.entries(ROBLOX_GROUPS.DIVISIONS)) {
    const divGroup = groups.find(g => g.group?.id === divDef.groupId);
    if (divGroup) {
      divisions[divKey] = `${divGroup.role?.name} (Rank ${divGroup.role?.rank})`;
    }
  }

  return {
    mainGroupRank: mainGroup ? `${mainGroup.role?.name} (Rank ${mainGroup.role?.rank})` : "Not in main group",
    darkCouncilRank: darkCouncil ? `${darkCouncil.role?.name} (Rank ${darkCouncil.role?.rank})` : "None",
    divisions
  };
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
    const [docRes, entryRes, statuteRes] = await Promise.all([
      supabase.from("library_documents").select("id,library_key,slug,article_number,title,status,display_order").order("display_order", { ascending: true }),
      supabase.from("library_entries").select("id,document_id,anchor,label,body,sub_clauses,display_order").order("display_order", { ascending: true }),
      supabase.from("codex_statutes").select("id,title,summary,sections,is_published,created_at")
    ]);

    if (docRes?.error) console.warn("[H.O.L.O AI] Error fetching library_documents:", docRes.error?.message || docRes.error);
    if (entryRes?.error) console.warn("[H.O.L.O AI] Error fetching library_entries:", entryRes.error?.message || entryRes.error);
    if (statuteRes?.error) console.warn("[H.O.L.O AI] Error fetching codex_statutes:", statuteRes.error?.message || statuteRes.error);

    const docList = Array.isArray(docRes?.data) ? docRes.data : [];
    const entryList = Array.isArray(entryRes?.data) ? entryRes.data : [];
    const statuteList = Array.isArray(statuteRes?.data) ? statuteRes.data : [];

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
    console.error("[H.O.L.O AI] Fatal getCachedLibraryDocuments error:", error);
    return cachedLibraryDocs || [];
  }
}

async function searchBotLibraryRegulations(queryStr, libraryKeyFilter) {
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

  // Single-letter Roman numeral ONLY if explicitly preceded by indicator word (e.g. "reign i", "emperor x")
  const singleMatch = clean.match(/\b(?:reign|emperor|#|sovereign|the)\s+(i|v|x)\b/i);
  if (singleMatch) {
    const singleMap = { i: 1, v: 5, x: 10 };
    const num = singleMap[singleMatch[1].toLowerCase()];
    if (num) reigns.add(num);
  }

  return { reigns: Array.from(reigns), isCurrent };
}

async function searchAllBotArchives(queryStr) {
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

  // 2. Hierarchy items
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
  const { data: dbArticles } = await supabase.from("archive_articles").select("*").limit(20);
  if (dbArticles?.length) {
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
  }

  // 4. Resource transmissions
  const { data: transmissions } = await supabase.from("resource_transmissions").select("*").limit(10);
  if (transmissions?.length) {
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

export function resolveTimeframeWindow(rawTimeframe) {
  const raw = String(rawTimeframe || "").toLowerCase().trim();
  const now = new Date();

  const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 1);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  };

  // 1. Check for explicit all-time / lifetime / ever
  if (/\b(all[\s_-]*time|ever|lifetime|entire\s*history|cumulative)\b/i.test(raw)) {
    return { type: "all_time", label: "all-time cumulative", isAllTime: true };
  }

  // 2. TODAY / 24H / YESTERDAY
  if (/\b(today|daily|this\s*day)\b/i.test(raw)) {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return { type: "today", startDate: start, endDate: now, label: "today", isLiveShiftsOnly: true };
  }
  if (/\b(24h|24\s*hours|past\s*24\s*hours|last\s*24\s*hours)\b/i.test(raw)) {
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return { type: "24h", startDate: start, endDate: now, label: "past 24 hours", isLiveShiftsOnly: true };
  }
  if (/\b(yesterday)\b/i.test(raw)) {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCHours(23, 59, 59, 999);
    return { type: "yesterday", startDate: start, endDate: end, label: "yesterday", isLiveShiftsOnly: true };
  }

  // 3. N WEEKS AGO (e.g. "2 weeks ago", "15 weeks ago")
  const weeksAgoMatch = raw.match(/(\d+)\s*weeks?\s*ago/i);
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

  // 4. LAST / PREVIOUS WEEK
  if (/\b(last\s*week|prev(ious)?\s*week|1\s*week\s*ago)\b/i.test(raw)) {
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

  // 5. THIS / CURRENT WEEK (or explicit mentions of week)
  if (/\b(this\s*week|current\s*week|past\s*week|7\s*days|week)\b/i.test(raw)) {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { type: "this_week", startDate: start, endDate: now, label: "this week (past 7 days)", isLiveShiftsOnly: true };
  }

  // 6. LAST MONTH / THIS MONTH
  if (/\b(last\s*month|prev(ious)?\s*month|1\s*month\s*ago)\b/i.test(raw)) {
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
  if (/\b(this\s*month|current\s*month)\b/i.test(raw)) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { type: "this_month", startDate: start, endDate: now, label: `this month (${start.toISOString().slice(0, 7)})`, isLiveShiftsOnly: false };
  }

  // 7. LAST YEAR / THIS YEAR
  if (/\b(last\s*year|prev(ious)?\s*year|1\s*year\s*ago)\b/i.test(raw)) {
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
  if (/\b(this\s*year|current\s*year)\b/i.test(raw)) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return { type: "this_year", startDate: start, endDate: now, label: `this year (${now.getUTCFullYear()})`, isLiveShiftsOnly: false };
  }

  // 8. ROLLING (e.g. "past 3 days", "last 2 weeks")
  const rollingMatch = raw.match(/(past|last)\s*(\d+)\s*(days?|weeks?|months?|years?|hours?)/i);
  if (rollingMatch) {
    const count = parseInt(rollingMatch[2], 10);
    const unit = rollingMatch[3].toLowerCase();
    let start;
    if (unit.startsWith("hour")) start = new Date(now.getTime() - count * 60 * 60 * 1000);
    else if (unit.startsWith("day")) start = new Date(now.getTime() - count * 24 * 60 * 60 * 1000);
    else if (unit.startsWith("week")) start = new Date(now.getTime() - count * 7 * 24 * 60 * 60 * 1000);
    else if (unit.startsWith("month")) start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count, now.getUTCDate()));
    else if (unit.startsWith("year")) start = new Date(Date.UTC(now.getUTCFullYear() - count, now.getUTCMonth(), now.getUTCDate()));

    return {
      type: "rolling_range",
      startDate: start,
      endDate: now,
      label: `past ${count} ${unit}`,
      isLiveShiftsOnly: count <= 1 && unit.startsWith("week")
    };
  }

  // 9. Specific date YYYY-MM-DD
  const dateMatch = raw.match(/(\d{4}-\d{2}-\d{2})/i);
  if (dateMatch) {
    const parsed = new Date(dateMatch[1] + "T00:00:00Z");
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

  // DEFAULT FOR ACTIVE DUTY / LEADERBOARD QUERIES: This week (past 7 days)
  const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { type: "this_week", startDate: defaultStart, endDate: now, label: "this week (past 7 days)", isLiveShiftsOnly: true };
}

async function executeBotToolCall(toolName, args) {
  console.log(`[H.O.L.O Bot AI Executing Tool] Function: ${toolName}`, args);
  try {
    if (toolName === "lookup_personnel" || toolName === "lookup_roblox_user") {
      const queryStr = String(args.query || args.username || "").trim();
      if (!queryStr) return { error: "No query provided." };

      let robloxId = null;
      let robloxUsername = null;
      let linkRow = null;

      const isNumeric = /^\d+$/.test(queryStr);

      if (isNumeric) {
        const { data } = await supabase
          .from("verification_links")
          .select("*")
          .eq("discord_user_id", queryStr)
          .maybeSingle();

        if (data) {
          linkRow = data;
          robloxUsername = linkRow.roblox_username;
          robloxId = String(linkRow.roblox_user_id);
        } else {
          robloxId = queryStr;
        }
      } else {
        const rUser = await resolveRobloxUser(queryStr);
        if (rUser?.id) {
          robloxId = String(rUser.id);
          robloxUsername = rUser.name;
        }
      }

      if (robloxId) {
        if (!linkRow) {
          const { data } = await supabase
            .from("verification_links")
            .select("*")
            .eq("roblox_user_id", String(robloxId))
            .maybeSingle();
          linkRow = data;
        }
      }

      if (!linkRow || !robloxId) {
        const { data: shiftMatches } = await supabase
          .from("clock_shifts")
          .select("discord_user_id, discord_username, roblox_user_id, roblox_username")
          .or(`roblox_username.ilike.%${queryStr}%,discord_username.ilike.%${queryStr}%,discord_user_id.eq.${queryStr},roblox_user_id.eq.${queryStr}`)
          .limit(1);

        if (shiftMatches?.[0]) {
          const match = shiftMatches[0];
          if (!robloxId && match.roblox_user_id) robloxId = String(match.roblox_user_id);
          if (!robloxUsername && match.roblox_username) robloxUsername = match.roblox_username;
          if (!linkRow && match.discord_user_id) linkRow = { discord_user_id: match.discord_user_id, roblox_user_id: match.roblox_user_id };
        }
      }

      if (robloxId) {
        const groupInfo = await fetchRobloxGroupRosters(robloxId);

        return {
          found: true,
          robloxUserId: String(robloxId),
          robloxUsername: robloxUsername || queryStr,
          discordUserId: linkRow?.discord_user_id || "Unlinked",
          mainGroupRank: groupInfo.mainGroupRank,
          darkCouncilRank: groupInfo.darkCouncilRank,
          divisionRanks: groupInfo.divisions
        };
      }

      return { found: false, message: `No Imperial personnel or Roblox user record found for '${queryStr}'.` };
    }

    if (toolName === "get_library_documents" || toolName === "get_statutes") {
      let queryStr = String(args.query || args.search || "").trim();
      if (["all", "list", "library", "documents", "ip", "imperial policy", "imperial policies", "policy", "policies", "rules", "regulations", "statutes", "*"].includes(queryStr.toLowerCase())) {
        queryStr = "";
      }
      const libraryKey = String(args.libraryKey || args.category || "").trim();
      const docs = await searchBotLibraryRegulations(queryStr, libraryKey);
      return docs?.length ? docs : { message: `No Imperial library regulations or handbooks found matching '${queryStr || "all"}'.` };
    }

    if (toolName === "get_archives") {
      let queryStr = String(args.query || args.search || "").trim();
      if (["all", "list", "archives", "*"].includes(queryStr.toLowerCase())) {
        queryStr = "";
      }

      const articles = await searchAllBotArchives(queryStr);
      return articles?.length ? articles : { message: `No archive articles found matching '${queryStr || "all"}'.` };
    }

    if (toolName === "get_powerbases") {
      let nameFilter = String(args.name || args.query || "").trim();
      if (["all", "any", "list", "*", "undefined", "null"].includes(nameFilter.toLowerCase())) {
        nameFilter = "";
      }

      let query = supabase.from("powerbases").select("*, powerbase_members(*)").neq("status", "DISSOLVED");
      if (nameFilter) query = query.ilike("name", `%${nameFilter}%`);

      let { data: powerbases } = await query;
      if (!powerbases || !powerbases.length) {
        const { data: allPb } = await supabase.from("powerbases").select("*, powerbase_members(*)").neq("status", "DISSOLVED");
        powerbases = (allPb || []).filter(pb =>
          pb.name?.toLowerCase().includes(nameFilter.toLowerCase()) ||
          pb.description?.toLowerCase().includes(nameFilter.toLowerCase())
        );
        if (!powerbases.length && !nameFilter) {
          powerbases = allPb || [];
        }
      }

      const allUserIds = new Set();
      (powerbases || []).forEach(pb => {
        if (pb.leader_id) allUserIds.add(String(pb.leader_id));
        (pb.powerbase_members || []).forEach(m => {
          if (m.user_id) allUserIds.add(String(m.user_id));
        });
      });

      // Fetch recent powerbase logs
      const { data: pbLogs } = await supabase.from("powerbase_logs").select("*").order("created_at", { ascending: false }).limit(10);

      const userMap = {};
      if (allUserIds.size > 0) {
        const idList = Array.from(allUserIds);
        const { data: links } = await supabase
          .from("verification_links")
          .select("discord_user_id,discord_username,roblox_username")
          .in("discord_user_id", idList);
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

      let query = supabase
        .from("division_weekly_reports")
        .select("*, division_weekly_report_members(*)")
        .eq("status", "published")
        .order("week_start", { ascending: false })
        .limit(limit);

      if (scope !== "all" && scope !== "*") {
        query = query.eq("division_key", scope);
      }
      if (weekStart) {
        query = query.eq("week_start", weekStart);
      }

      const { data: reports, error } = await query;
      if (error) {
        return { error: `Database query error: ${error.message}` };
      }

      if (!reports || reports.length === 0) {
        return { message: `No published weekly reports found for scope '${scope}'${weekStart ? ` and week_start '${weekStart}'` : ""}.` };
      }

      let robloxIdsToMatch = new Set();
      if (targetUser) {
        if (/^\d+$/.test(targetUser)) {
          robloxIdsToMatch.add(targetUser);
          const { data: vLink } = await supabase
            .from("verification_links")
            .select("roblox_user_id")
            .eq("discord_user_id", targetUser)
            .maybeSingle();
          if (vLink?.roblox_user_id) {
            robloxIdsToMatch.add(String(vLink.roblox_user_id));
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

      const needsRankIndex = Boolean(rankBracket && rankBracket !== "all" && rankBracket !== "*");
      const [allRosters, vLinksRes] = await Promise.all([
        needsRankIndex ? fetchAllRankRosters().catch(() => ({})) : Promise.resolve({}),
        supabase.from("verification_links").select("discord_user_id,discord_username,roblox_user_id,roblox_username")
      ]);
      const vLinks = vLinksRes?.data || [];

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
        let reportQuery = supabase
          .from("division_weekly_reports")
          .select("*, division_weekly_report_members(*)")
          .eq("status", "published")
          .gte("week_start", timeframeInfo.targetWeekStart)
          .lte("week_start", timeframeInfo.endDate.toISOString().slice(0, 10))
          .order("week_start", { ascending: false });

        if (scope !== "all" && scope !== "*") reportQuery = reportQuery.eq("division_key", scope);

        let { data: pastReports } = await reportQuery;

        // Fallback: If no report matches that exact Monday, search for closest report on or before target end date
        if (!pastReports || pastReports.length === 0) {
          let fallbackQuery = supabase
            .from("division_weekly_reports")
            .select("*, division_weekly_report_members(*)")
            .eq("status", "published")
            .lte("week_start", timeframeInfo.endDate.toISOString().slice(0, 10))
            .order("week_start", { ascending: false });

          if (scope !== "all" && scope !== "*") fallbackQuery = fallbackQuery.eq("division_key", scope);
          const { data: closestReports } = await fallbackQuery.limit(scope === "all" ? 6 : 1);
          pastReports = closestReports || [];
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
        let shiftQuery = supabase
          .from("clock_shifts")
          .select("id,discord_user_id,discord_username,roblox_user_id,roblox_username,duration_seconds,adjustment_seconds,status,scope,started_at,ended_at");

        if (scope !== "all" && scope !== "*") shiftQuery = shiftQuery.eq("scope", scope);

        if (timeframeInfo.startDate) {
          shiftQuery = shiftQuery.gte("started_at", timeframeInfo.startDate.toISOString());
        }
        if (timeframeInfo.endDate && !timeframeInfo.isAllTime) {
          shiftQuery = shiftQuery.lte("started_at", timeframeInfo.endDate.toISOString());
        }

        if (targetUser) {
          shiftQuery = shiftQuery.or(`discord_user_id.eq.${targetUser},roblox_username.ilike.%${targetUser}%,discord_username.ilike.%${targetUser}%,roblox_user_id.eq.${targetUser}`);
        }

        const { data: shifts } = await shiftQuery;

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
          let reportQuery = supabase
            .from("division_weekly_reports")
            .select("*, division_weekly_report_members(*)")
            .eq("status", "published")
            .order("week_start", { ascending: false });

          if (scope !== "all" && scope !== "*") reportQuery = reportQuery.eq("division_key", scope);
          if (timeframeInfo.startDate && !timeframeInfo.isAllTime) {
            reportQuery = reportQuery.gte("week_start", timeframeInfo.startDate.toISOString().slice(0, 10));
          }
          if (timeframeInfo.endDate && !timeframeInfo.isAllTime) {
            reportQuery = reportQuery.lte("week_start", timeframeInfo.endDate.toISOString().slice(0, 10));
          }

          const { data: pastReports } = await reportQuery;

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
      } else if (needsRankIndex) {
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
      const [roster, { data: reports }, { data: inspections }] = await Promise.all([
        fetchDivisionRoster(div).catch(() => []),
        supabase.from("division_weekly_reports").select("*, division_weekly_report_members(*)").eq("division_key", div).order("created_at", { ascending: false }).limit(3),
        supabase.from("division_inspections").select("*, division_inspection_sections(*)").eq("division_key", div).order("created_at", { ascending: false }).limit(3)
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
      const { data: proposals } = await supabase.from("council_proposals").select("*, council_votes(*)").order("created_at", { ascending: false }).limit(5);
      return {
        totalProposals: proposals?.length || 0,
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
      let query = supabase.from("group_timeline_entries").select("*").order("display_order", { ascending: true }).limit(15);
      if (clean) {
        query = query.or(`title.ilike.%${clean}%,body.ilike.%${clean}%`);
      }
      const { data: entries } = await query;
      return {
        entries: (entries || []).slice(0, 10)
      };
    }

    return { error: `Tool ${toolName} not supported.` };
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
      .replace(/<[\/]?parameter>/g, "")
      .trim();
  }
}

const CONVERSATION_TTL_MS = 20 * 60 * 1000; // 20 minutes
const MAX_HISTORY_TURNS = 4; // Last 2 user queries + 2 assistant replies (keeps context token-lean)
const botUserMemory = new Map();

function getOrCreateHistory(sessionKey) {
  const now = Date.now();
  const existing = botUserMemory.get(sessionKey);
  if (existing && (now - existing.lastUpdated) < CONVERSATION_TTL_MS) {
    existing.lastUpdated = now;
    return existing.messages;
  }
  const fresh = { lastUpdated: now, messages: [] };
  botUserMemory.set(sessionKey, fresh);

  // Periodically evict stale sessions
  if (botUserMemory.size > 200) {
    for (const [key, val] of botUserMemory.entries()) {
      if (now - val.lastUpdated > CONVERSATION_TTL_MS) {
        botUserMemory.delete(key);
      }
    }
  }
  return fresh.messages;
}

export async function queryHoloAi({ prompt, userTag, robloxName, isSuperUser, userId, channelId }) {
  const apiKey = String(process.env.GROQ_API_TOKEN || "").trim();

  if (!apiKey) {
    throw new Error("GROQ_API_TOKEN is not configured.");
  }

  const sessionKey = userId ? `${userId}:${channelId || "global"}` : (userTag || "global");
  const history = getOrCreateHistory(sessionKey);
  const isExemptUser = EXEMPT_USER_IDS.has(String(userId || ""));

  const systemContext = buildBotSystemPrompt(isExemptUser, robloxName, userTag, userId);

  let messages = [
    { role: "system", content: systemContext },
    ...history.slice(-MAX_HISTORY_TURNS).map(m => ({
      role: m.role,
      content: m.content
    })),
    { role: "user", content: prompt }
  ];

  let iterations = 0;
  let finalContent = "";
  const executedToolCalls = [];

  while (iterations < 4) {
    iterations++;

    // In iteration 1, tools are enabled. After tools have executed, omit tools entirely so the model synthesizes the answer.
    const toolsEnabled = executedToolCalls.length === 0;

    const chatPayload = { messages };
    if (toolsEnabled) {
      chatPayload.tools = OVERSEER_TOOLS;
      chatPayload.tool_choice = "auto";
    }

    const result = await executeGroqChat(apiKey, chatPayload);

    if (!result.ok) {
      const errInfo = result.error;
      console.error("[H.O.L.O Bot AI Error]:", errInfo);
      if (errInfo?.status === 429 || String(errInfo?.body || "").includes("rate_limit")) {
        const secondsMatch = String(errInfo.body || "").match(/try again in ([\d\.]+\s*s(?:econds)?|[\d\.]+\s*m(?:inutes)?)/i);
        const timeStr = secondsMatch ? secondsMatch[1] : "a few seconds";
        return `Holonet archive rate limit reached. Try again in ${timeStr}.`;
      }
      throw new Error(`Groq API returned ${errInfo?.status || 500}: ${errInfo?.body || "Unknown error"}`);
    }

    const choiceMessage = result.data.choices?.[0]?.message;
    if (!choiceMessage) break;

    parseXmlToolCalls(choiceMessage);

    if (choiceMessage.tool_calls && choiceMessage.tool_calls.length > 0 && toolsEnabled) {
      messages.push(choiceMessage);

      for (const toolCall of choiceMessage.tool_calls) {
        const fnName = toolCall.function?.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(toolCall.function?.arguments || "{}");
        } catch { }

        const toolResult = await executeBotToolCall(fnName, fnArgs);
        executedToolCalls.push({ fnName, fnArgs, toolResult });

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

  // Factual synthesis fallback if LLM returned empty content after tool execution
  if (!finalContent && executedToolCalls.length > 0) {
    const shiftTool = executedToolCalls.find(t => t.fnName === "get_shift_totals");
    if (shiftTool?.toolResult) {
      const tr = shiftTool.toolResult;
      if (tr.topUser) {
        finalContent = `**Top Active Member (${tr.timeframe}):** ${tr.topUser.name} (${tr.topUser.rankTitle || "Member"}) with **${tr.topUser.hours} hours**.\nTotal active duty time: **${tr.totalHours} hours** across **${tr.totalUsers} members**.`;
      } else if (tr.userQuery) {
        finalContent = tr.userQuery.totalHours !== undefined
          ? `**Personnel:** ${tr.userQuery.name} (${tr.userQuery.rankTitle || "Member"}) — **${tr.userQuery.totalHours} hours** logged (${tr.timeframe}).`
          : `No shift records found for ${tr.userQuery.query} (${tr.timeframe}).`;
      } else if (tr.leaderboardTop10?.length > 0) {
        const top = tr.leaderboardTop10[0];
        finalContent = `**Top Active Member (${tr.timeframe}):** ${top.name} (${top.rankTitle || "Member"}) with **${top.totalHours} hours**.`;
      }
    }
  }

  if (isExemptUser) {
    finalContent = finalContent.replace(/\[NO_RESPONSE\]/gi, "").trim();
    if (!finalContent) {
      finalContent = "Transmission acknowledged, My Lord. How may H.O.L.O assist you?";
    }
  } else if (!finalContent || finalContent.includes("[NO_RESPONSE]")) {
    return "";
  }

  history.push({ role: "user", content: prompt.slice(0, 300) });
  history.push({ role: "assistant", content: finalContent.slice(0, 300) });
  if (history.length > MAX_HISTORY_TURNS) {
    history.splice(0, history.length - MAX_HISTORY_TURNS);
  }

  return finalContent;
}
