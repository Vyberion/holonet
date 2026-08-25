import { supabase } from "./supabase.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";
import { emperorArchiveItems, hierarchyItems } from "../../modules/data/hierarchy.js";
import { fetchDivisionRoster } from "../../src/lib/api-helpers.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_ENDPOINT = "https://api.groq.com/openai/v1/models";

const DEFAULT_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
  "llama3-70b-8192",
  "llama3-8b-8192"
];

let cachedModels = null;
let lastModelFetchTime = 0;
let lastSuccessfulModel = "llama-3.3-70b-versatile";
const CACHE_TTL_MS = 10 * 60 * 1000;

function getModelPriorityScore(modelId, contextWindow = 0) {
  const id = String(modelId || "").toLowerCase();
  
  // Flagship Llama 3.3
  if (id.includes("llama-3.3-70b-versatile") || id === "llama-3.3-70b") return 1000;
  if (id.includes("llama-3.3")) return 900;
  
  // Fast Llama 3.1
  if (id.includes("llama-3.1-8b-instant") || id === "llama-3.1-8b") return 800;
  if (id.includes("llama-3.1-70b")) return 750;
  if (id.includes("llama-3.1")) return 700;
  
  // Standard Llama 3
  if (id.includes("llama3-70b")) return 600;
  if (id.includes("llama3-8b")) return 500;
  if (id.includes("llama")) return 400;
  
  // Other models ranked by context window
  return Math.min(300, Math.floor(contextWindow / 1000));
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
      headers: { "Authorization": `Bearer ${primaryKey}` }
    });
    if (res.ok) {
      const json = await res.json();
      const rawList = Array.isArray(json?.data) ? json.data : [];
      
      const filtered = rawList.filter(m => {
        const id = String(m.id || "").toLowerCase();
        if (m.active === false) return false;
        if (id.includes("whisper") || id.includes("guard") || id.includes("embed") || id.includes("vision") || id.includes("preview") || id.includes("distill")) return false;
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
  const activeModels = rawCandidateModels.filter(m => !isModelRateLimited(m));
  const candidateModels = activeModels.length > 0 ? [...activeModels] : [...rawCandidateModels];

  // If we have a known working model that isn't on cooldown, prioritize it to avoid cycling
  if (lastSuccessfulModel && !isModelRateLimited(lastSuccessfulModel)) {
    const idx = candidateModels.indexOf(lastSuccessfulModel);
    if (idx > -1) {
      candidateModels.splice(idx, 1);
    }
    candidateModels.unshift(lastSuccessfulModel);
  }

  for (const currentKey of keys) {
    for (const model of candidateModels) {
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
          })
        });

        if (response.ok) {
          const data = await response.json();
          lastSuccessfulModel = model; // Pin the successful model!
          return { ok: true, data, model };
        }

        const errText = await response.text().catch(() => "");
        lastError = { status: response.status, body: errText, model };

        if (response.status === 429 || errText.includes("rate_limit")) {
          markModelRateLimited(model, 60000);
          console.warn(`[H.O.L.O Groq Failover] Model ${model} rate limited (cooling down 60s). Trying next candidate model...`);
          continue;
        }

        if (response.status === 400 || response.status === 404 || response.status === 503) {
          markModelRateLimited(model, 300000); // 5 min cooldown for broken/missing models
          console.warn(`[H.O.L.O Groq Failover] Model ${model} returned ${response.status}. Trying next candidate model...`);
          continue;
        }

        break;
      } catch (err) {
        lastError = { status: 0, body: err?.message, model };
        continue;
      }
    }
  }

  return { ok: false, error: lastError };
}

const BOT_SYSTEM_PROMPT = `You are H.O.L.O (Holonet Operations & Logistics Overseer), the automated central intelligence archive of the Sith Empire.

OPERATIONAL RUBRIC & CITATION PROTOCOL:

1. VALIDITY, LANGUAGE & SILENCE PROTOCOL (STRICT):
- ENGLISH ONLY: You exclusively process and respond in the English language.
- REJECT TRANSLATIONS: NEVER fulfill requests to translate text into other languages or translate from other languages. If asked to translate, output EXACTLY: [NO_RESPONSE]
- REJECT NON-ENGLISH, USELESS PROMPTS & NONSENSE: If the query is in a foreign language, is gibberish, spam, meaningless chatter, casual greetings ("hi", "yo", "ok", "cool"), real-world off-topic banter, or is NOT a valid recognized question/request regarding Imperial matters, lore, hierarchy, regulations, or Star Wars history within the allowed era, output EXACTLY: [NO_RESPONSE]
- Do NOT output any apology, greeting, or refusal text—output ONLY [NO_RESPONSE].

2. CORE DEMEANOR & FORM:
- You are the central Holonet archive of the Sith Empire: austere, authoritative, strictly objective, precise, and utilitarian.
- ZERO conversational filler or pleasantries: Never output greetings ("Greetings", "Hello"), affirmations ("Understood", "Certainly"), or conversational sign-offs ("Let me know if you need further data", "May the Force be with you").
- ZERO sci-fi tech-babble: Do NOT use colloquial cybernetic clichés or address users as "Operator". Deliver requested data, rulings, and encyclopedia entries directly without conversational headers or footers.

3. INTENT INFERENCE & REGULATION LOOKUPS:
- You must understand shorthand, gaming slang, and informal questions regarding Imperial protocol.
- Any question asking what is permitted, prohibited, punishable, or standard procedure (e.g. "can I tk", "is rdm allowed", "jailing rules", "what happens if I disobey an officer", "kos rules") is an inquiry into Imperial Regulations / Codex / Statutes.
- For ANY regulatory, conduct, procedural, or handbook inquiry, ALWAYS invoke get_library_documents using translated formal terminology (e.g. translate "tk" -> "team killing friendly fire fratricide combat rules").

4. ENCYCLOPEDIC REASONING & ABSOLUTE DATABASE FIDELITY:
- ALWAYS invoke get_library_documents for any rule, combat permission, conduct inquiry, or protocol.
- STRICT PROHIBITION ON HALLUCINATING POLICY NAMES: NEVER invent, guess, or fabricate fake policies, fake IP numbers, or unwritten clauses (e.g. NEVER fabricate "Imperial Policy 7, Combat Conduct, Article 3, Clause b").
- EXACT DATABASE REPRODUCTION & CITATION:
  * You MUST cite and quote directly from the retrieved database Article and Regulation entries:
    Format: [ARTICLE X: Title — Regulation Y] or [ARTICLE X Regulation Y] (with [Sub-Section Z] if applicable).
  * State the exact conditions from the database text (e.g. if the retrieved entry states: "Team Killing is only permissible in the act of self defense, or while in the proper areas (dueling mats or outside of the temple)...", cite it word-for-word and explain the rule with 100% precision).
- Grounding for Live Server Data: For specific numbers, powerbase rosters, shift hours, and council votes, strictly report retrieved live database state without fabricating fictitious usernames or numbers.

5. OUTPUT FORMATTING (STRICTLY NO MARKDOWN TABLES):
- NEVER output markdown tables (pipes and dashes |---|---|). Discord does NOT render markdown table columns properly and breaks formatting.
- ALWAYS present leaderboards, rosters, statistics, and query results using clean numbered lists or bullet points:
  * Example Leaderboard format:
    1. **crushingly** (_jessie1211) — 23.9 hrs (1,433 mins) • 2 shifts
    2. **BarrakudaCERO** (barrakuda0) — 15.4 hrs (927 mins) • 13 shifts [Active On Duty]
- Keep all responses structured, compact, scannable, and bolded for immediate readability.

6. IN-UNIVERSE STAR WARS LORE & TEMPORAL ERA BOUNDARY (CRITICAL STRICT PROHIBITION):
- ENCYCLOPEDIC LORE MASTERY: Be highly open, detailed, and encyclopedic when asked about Star Wars lore, Sith philosophy, ancient artifacts, force techniques, historical battles, and galactic history within your allowed temporal era.
- STRICT ERA TEMPORAL BOUNDARY RULE:
  * ALLOWED ERA (THE PAST): You MAY discuss Star Wars lore, historical figures, philosophy, and events that occurred in the past up to and during the golden era of the Reconstituted Sith Empire under Emperor Darth Vitiate (e.g. Ancient Sith, Dawn of the Jedi, Hundred-Year Darkness, Great Hyperspace War, Great Sith War, Mandalorian Wars, Jedi Civil War, Great Galactic War, Cold War, Reconstituted Sith Empire).
  * STRICTLY PROHIBITED ERAS (POST-VITIATE / FUTURE ERAS): You MUST NEVER answer, discuss, cite, or acknowledge Star Wars events, characters, or eras that happened AFTER or near the Fall of Darth Vitiate and the Reconstituted Sith Empire, before or during/after the Eternal Empire / Zakuul, or any modern eras (e.g. Ruusan Reformation, Darth Bane / Rule of Two, High Republic, Prequel Era / Clone Wars, Galactic Empire / Palpatine / Darth Vader, Rebellion, New Republic, Sequel Era, or Legacy Era).
  * IF ASKED ABOUT PROHIBITED FUTURE ERAS OR POST-VITIATE EVENTS: Output EXACTLY: [NO_RESPONSE]
- Never give out-of-universe real-world emergency advice or moral lectures.

7. TIME LOGGING & ARBITRARY TIMEFRAME SUPPORT (INFINITE COMBINATIONS):
- UNIVERSAL TIMEFRAME RESOLUTION: The system supports ANY relative or absolute timeframe combination:
  * "2 weeks ago", "15 weeks ago", "last week", "3 weeks ago", "week of 2026-08-10" -> Queries that past week's published report or date window.
  * "3 months ago", "last month", "this month", "5 months ago" -> Queries that monthly window.
  * "last year", "this year", "2 years ago", "2025" -> Queries that yearly window.
  * "this week", "in 1 week", "past 7 days", "today", "yesterday", "24h" -> Queries live duty shifts or daily window.
  * "all-time", "ever", "overall", "total" -> Queries cumulative all-time history.
- Always pass the user's requested timeframe string (e.g. timeframe: "2 weeks ago", "15 weeks ago", "3 months ago", "last year", "August 2026") directly to get_shift_totals or get_weekly_reports.
- Synthesize and explain the relations between report members (division_weekly_report_members), parent reports (division_weekly_reports), and personnel identity (verification_links).`;

const OVERSEER_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_library_documents",
      description: "Query official Imperial regulations, Imperial Policies (IP), Codex entries, doctrine handbooks, combat rules, jailing protocols, and division directives. Use when queried on any rules, permissions, conduct (including slang like 'tk', 'rdm', 'kos', 'aa', 'jailing'), or division procedures.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query, IP number, keyword, or translated regulation topic (e.g. 'team killing friendly fire', 'IP 3', 'Article 1', 'jailing detainment', 'combat duels', 'insubordination')" },
          libraryKey: { type: "string", description: "Optional division or library scope filter (e.g. 'codex', 'reavers', 'dhg', 'inquisitors', 'dreadmasters', 'highranks', 'darkCouncil')" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "lookup_personnel",
      description: "Query the Imperial roster for a specific individual's Roblox username or Discord ID to inspect their rank, verified link, and division memberships. Execute ONLY when the user explicitly asks to check or look up a person's rank, profile, or identity.",
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
      description: "Retrieve historical Imperial archives, Emperor biographies and reigns, past events, and historical Sith Order records. Use when the user asks about Emperor history, past eras, or historical lore.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query or Emperor name/number (e.g. 'Emperor Gurt', 'Odin', 'Kaggath', 'first emperor')" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_powerbases",
      description: "Fetch active Imperial Powerbase registries, sovereign leadership, prestige, and rosters. Execute ONLY when the user explicitly asks about powerbases or powerbase statistics.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Optional name of a specific powerbase to filter by. Omit or leave empty to list all powerbases." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_shift_totals",
      description: "Retrieve logged duty shift hours, leaderboards, top active personnel, and duty statistics for a specific user, division scope, or entire Sith Order across current shifts and compiled weekly reports. Accepts ANY arbitrary timeframe: '2 weeks ago', '15 weeks ago', 'last week', '3 months ago', 'last year', 'this month', 'today', 'yesterday', '24h', 'all_time', 'August 2026', '2025', 'past 3 weeks'. Use when queried on shift time, hours, leaderboards, or duty statistics for any timeframe.",
      parameters: {
        type: "object",
        properties: {
          user: { type: "string", description: "Optional Roblox username or Discord ID of a specific user to query shift time for." },
          scope: {
            type: "string",
            enum: ["reavers", "dhg", "inquisitors", "dreadmasters", "highranks", "darkCouncil", "all"],
            description: "Division scope to query shift totals for. Defaults to 'all'."
          },
          timeframe: {
            type: "string",
            description: "Any timeframe or period query. Examples: '2 weeks ago', '15 weeks ago', 'last week', '3 months ago', 'last year', 'this month', '1 week', 'today', 'yesterday', 'all_time', 'August 2026'."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_weekly_reports",
      description: "Retrieve compiled weekly reports and report member logs for time logged beyond this week, past weeks, member report entries, or events hosted/attended in reports. Use when asked for past week reports, historical time logged beyond this week, member report statistics, or events in reports.",
      parameters: {
        type: "object",
        properties: {
          scope: {
            type: "string",
            enum: ["reavers", "dhg", "inquisitors", "dreadmasters", "highranks", "darkCouncil", "all"],
            description: "Optional division scope filter."
          },
          weekStart: {
            type: "string",
            description: "Optional week start date in YYYY-MM-DD format (e.g. '2026-08-17')."
          },
          user: {
            type: "string",
            description: "Optional Roblox username, Roblox user ID, or Discord user ID to filter report member entries for a specific individual."
          },
          limit: {
            type: "number",
            description: "Number of reports to retrieve. Defaults to 5."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_division_activity",
      description: "Fetch division activity records, current rosters, weekly reports, or inspection records. Execute when division activity, rosters, quotas, or inspection reports are queried.",
      parameters: {
        type: "object",
        properties: {
          division: {
            type: "string",
            enum: ["reavers", "dhg", "inquisitors", "dreadmasters", "highranks", "darkCouncil"],
            description: "The division ID to query activity and roster for."
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
      description: "Retrieve legislative floor proposals, bills, and vote tallies from the Dark Council floor. Use when council proposals, laws, or floor legislation are queried.",
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
      description: "Retrieve major chronological Imperial timeline events, eras, and reforms. Use when timeline or historical chronological progression is requested.",
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

async function searchAllBotArchives(queryStr) {
  const cleanQuery = sanitizeQueryForSearch(queryStr);
  const tokens = extractSearchTokens(cleanQuery);
  let results = [];

  // 1. Static Emperor Archive profiles from hierarchy.js
  const emperorItems = emperorArchiveItems();
  for (const emp of emperorItems) {
    results.push({
      id: emp.slug,
      title: emp.name,
      category: "Emperor Biography",
      summary: emp.summary || "",
      content: `${emp.name} (${emp.title || ""})\nReign: ${emp.reign || ""}\n${emp.body || ""}`,
      slug: emp.slug
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
      content: `${item.name} (${item.groupTitle || ""})\n${item.body || ""}`,
      slug: item.slug
    });
  }

  // 3. Database archive articles
  const { data: dbArticles } = await supabase.from("archive_articles").select("*").limit(30);
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
  const { data: transmissions } = await supabase.from("resource_transmissions").select("*").limit(20);
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
    let filtered = results.filter(doc => {
      const fullText = `${doc.title} ${doc.summary} ${doc.content} ${doc.category}`.toLowerCase();
      return fullText.includes(cleanQuery);
    });

    if (!filtered.length && tokens.length > 0) {
      filtered = results.filter(doc => {
        const fullText = `${doc.title} ${doc.summary} ${doc.content} ${doc.category}`.toLowerCase();
        return tokens.some(t => fullText.includes(t));
      });
    }

    if (filtered.length) {
      results = filtered;
    }
  }

  const seen = new Set();
  const uniqueDocs = results.filter(doc => {
    const key = doc.id || doc.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueDocs.slice(0, 3).map(r => ({
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
          leaderName: userMap[pb.leader_id] || `Discord:<@${pb.leader_id}>`,
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
      const targetUser = String(args.user || args.username || "").trim();
      const timeframeInfo = resolveTimeframeWindow(args.timeframe || "");

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

      // 2. Query clock_shifts (live duty shifts) if not strictly an archived discrete past week report
      if (!timeframeInfo.isSpecificReport) {
        let shiftQuery = supabase
          .from("clock_shifts")
          .select("discord_user_id,discord_username,roblox_user_id,roblox_username,duration_seconds,adjustment_seconds,status,scope,started_at,ended_at");

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
        .map((u, index) => ({
          rank: index + 1,
          name: u.name,
          robloxUsername: u.robloxUsername || u.name,
          discordUsername: u.discordUsername || "",
          totalHours: Math.round((u.totalSeconds / 3600) * 10) / 10,
          totalMinutes: Math.round(u.totalSeconds / 60),
          shiftCount: u.shiftCount,
          reportLoggedHours: Math.round(((u.reportLoggedSeconds || 0) / 3600) * 10) / 10,
          onDutyNow: u.isActiveNow
        }));

      const topUser = rankedUsers[0] || null;

      return {
        scope,
        timeframe: `${timeframeInfo.label}${reportWeekLabel}`,
        timeframeType: timeframeInfo.type,
        isAllTimeQuery: timeframeInfo.isAllTime || false,
        totalUsersFound: userAggregates.size,
        totalHoursLogged: Math.round((totalCombinedSeconds / 3600) * 10) / 10,
        activeShiftsCount: activeCount,
        topUserThisTimeframe: topUser ? { rank: 1, name: topUser.name, hours: topUser.totalHours, minutes: topUser.totalMinutes } : null,
        leaderboardTop10: rankedUsers.slice(0, 10),
        userQuery: targetUser ? (rankedUsers.find(u => u.name.toLowerCase().includes(targetUser.toLowerCase()) || u.userId === targetUser) || { query: targetUser, message: "No recorded shift or report logs found for specified user." }) : null
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

const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY_TURNS = 12; // Last 6 user queries + 6 assistant replies
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

  const systemContext = `${BOT_SYSTEM_PROMPT}

SESSION CONTEXT:
- Asking User: ${robloxName || userTag || "User"}`;

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

  while (iterations < 5) {
    iterations++;

    const result = await executeGroqChat(apiKey, {
      messages,
      tools: OVERSEER_TOOLS,
      tool_choice: "auto"
    });

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

    if (choiceMessage.tool_calls && choiceMessage.tool_calls.length > 0) {
      messages.push(choiceMessage);

      for (const toolCall of choiceMessage.tool_calls) {
        const fnName = toolCall.function?.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(toolCall.function?.arguments || "{}");
        } catch { }

        const toolResult = await executeBotToolCall(fnName, fnArgs);

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

  if (!finalContent || finalContent.includes("[NO_RESPONSE]")) {
    return "";
  }

  history.push({ role: "user", content: prompt });
  history.push({ role: "assistant", content: finalContent });
  if (history.length > MAX_HISTORY_TURNS * 2) {
    history.splice(0, history.length - MAX_HISTORY_TURNS);
  }

  return finalContent;
}
