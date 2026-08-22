import { NextResponse } from "next/server";
import { getAuthContext } from "../../../../../modules/auth/auth-context.js";
import { supabaseRest } from "../../../../../modules/auth/session-store.js";
import {
  resolveUserByUsername,
  loadRobloxProfileSummary,
  ROBLOX_GROUPS,
  personnelLookupWarnings,
  fetchDivisionRoster
} from "../../../../lib/api-helpers.js";
import { emperorArchiveItems, hierarchyItems } from "../../../../../modules/data/hierarchy.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_ENDPOINT = "https://api.groq.com/openai/v1/models";

const DEFAULT_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "deepseek-r1-distill-llama-70b",
  "qwen-2.5-32b",
  "mistral-saba-24b"
];

let cachedModels = null;
let lastModelFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

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
        if (id.includes("whisper") || id.includes("guard") || id.includes("embed") || id.includes("vision")) return false;
        return true;
      });

      filtered.sort((a, b) => {
        const aId = String(a.id || "").toLowerCase();
        const bId = String(b.id || "").toLowerCase();
        const aCtx = Number(a.context_window || 0);
        const bCtx = Number(b.context_window || 0);

        // 1. Llama 3.3 first
        const aL33 = aId.includes("llama-3.3");
        const bL33 = bId.includes("llama-3.3");
        if (aL33 && !bL33) return -1;
        if (!aL33 && bL33) return 1;

        // 2. Llama 3.1 next
        const aL31 = aId.includes("llama-3.1");
        const bL31 = bId.includes("llama-3.1");
        if (aL31 && !bL31) return -1;
        if (!aL31 && bL31) return 1;

        // 3. Other Llama models
        const aL = aId.includes("llama");
        const bL = bId.includes("llama");
        if (aL && !bL) return -1;
        if (!aL && bL) return 1;

        // 4. Highest context window first
        return bCtx - aCtx;
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

async function executeGroqChat(apiKey, payload) {
  const keys = String(apiKey || "").split(",").map(k => k.trim()).filter(Boolean);
  let lastError = null;
  const candidateModels = await getAvailableGroqModels(keys[0]);

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
          return { ok: true, data, model };
        }

        const errText = await response.text().catch(() => "");
        lastError = { status: response.status, body: errText, model };

        if (response.status === 429 || errText.includes("rate_limit")) {
          console.warn(`[H.O.L.O Groq Failover] Model ${model} rate limited. Trying next candidate model...`);
          continue;
        }

        if (response.status === 400 || response.status === 404 || response.status === 503) {
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

const SYSTEM_PROMPT = `You are H.O.L.O (Holonet Operations & Logistics Overseer), the automated central intelligence terminal of the Sith Empire.

OPERATIONAL RUBRIC & CORE SPECIFICATION:

1. TERMINAL ARCHITECTURE & DEMEANOR:
- You are a pure mainframe terminal interface, not a conversational assistant or human companion.
- Maintain a cold, authoritative, strictly objective, precise, and utilitarian demeanor.
- ZERO conversational filler or pleasantries: Never output greetings ("Hello", "Greetings Operator"), affirmations ("Understood", "Certainly", "I can help with that"), self-referential conversational meta ("As an AI...", "As a machine..."), or sign-offs ("Let me know if you need anything else", "May the Force be with you").
- Deliver answers and requested data immediately without conversational headers or footers.

2. TOOL INVOCATION POLICY (STRICT NEED-DRIVEN ONLY):
- ONLY call lookup tools (lookup_personnel, get_powerbases, get_shift_totals, get_division_activity, get_library_documents, get_archives, get_council_floor, get_timeline) if the user's prompt EXPLICITLY requests specific database data or if current factual retrieval of live database state is strictly necessary.
- For regulations, rules, imperial policies (IP), decrees, and handbooks, ALWAYS query the Imperial Library documents and entries via get_library_documents.
- NEVER perform unsolicited or preemptive lookups on the asking user.
- NEVER look up powerbases, ranks, duty shifts, or rosters simply because a word or name was mentioned in passing.
- NEVER announce or mention a user's rank or status unless specifically queried about their rank or identity.

3. FLUENCY & REASONING OUTSIDE TOOLS:
- You possess full standalone capacity for logic, mathematics, code/syntax assistance, tactical reasoning, philosophical queries, Star Wars universe lore, and general inquiries.
- When a query does not require live Imperial database records, synthesize the answer directly from internal intelligence without invoking any tools.
- Never refuse a general knowledge or reasoning query because no tool was assigned to it.

4. IN-UNIVERSE ISOLATION & FAILSAFE DIRECTIVES:
- You operate exclusively within the fictional Sith Empire universe.
- ABSOLUTELY NO REAL-WORLD ADVICE OR DISCLAIMERS: Never output real-world crisis advice, emergency service numbers (e.g. 911, 999, 112, suicide hotlines, poison control), real-world legal counsel, or modern safety preachiness.
- Do NOT lecture, moralize, patronize, or offer emotional counsel.
- If given out-of-universe or non-Imperial crisis input, treat it strictly as an out-of-scope terminal query and deliver a neutral, cold terminal status (e.g., "TERMINAL NOTICE: Parameter unrecognized or beyond Imperial Holonet scope.") without breaking character.

5. OUTPUT FORMATTING:
- Structure information with maximum clarity using concise paragraphs, bullet points, headers, or markdown tables.
- State facts, rules, numbers, and answers directly and efficiently.`;

const OVERSEER_TOOLS = [
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
      name: "get_library_documents",
      description: "Query official Imperial regulations, Imperial Policies (IP), doctrine handbooks, operational directives, and published division library articles. Use when queried on regulations, rules, imperial policy, handbooks, or division procedures.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query, IP number, keyword, or regulation topic (e.g. 'IP 3', 'Article 1', 'jailing', 'combat', 'duels', 'handbook')" },
          libraryKey: { type: "string", description: "Optional division or library scope filter (e.g. 'codex', 'reavers', 'dhg', 'inquisitors', 'dreadmasters', 'highranks', 'darkCouncil')" }
        }
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
      description: "Retrieve logged duty shift hours and status for a specific user or division scope. Execute ONLY when shift time, hours, or leaderboards are explicitly requested.",
      parameters: {
        type: "object",
        properties: {
          user: { type: "string", description: "Optional Roblox username or Discord ID of a specific user to query shift time for." },
          scope: {
            type: "string",
            enum: ["reavers", "dhg", "inquisitors", "dreadmasters", "highranks", "darkCouncil", "all"],
            description: "Division scope to query shift totals for."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_division_activity",
      description: "Fetch division activity records, current rosters, weekly reports, or inspection records. Execute ONLY when division activity, rosters, or inspection reports are specifically requested.",
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
      description: "Retrieve legislative floor proposals, bills, and vote tallies from the Dark Council floor. Use when council proposals or floor legislation are queried.",
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

function extractSearchTokens(queryStr) {
  const clean = String(queryStr || "").toLowerCase().trim();
  const words = clean.split(/\s+/).filter(w => w && !["the", "a", "an", "for", "of", "in"].includes(w));
  const expanded = new Set(words);

  for (const word of words) {
    if (ROMAN_NUMERALS[word]) {
      expanded.add(ROMAN_NUMERALS[word].toLowerCase());
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
  let text = `[IMPERIAL REGULATION]: ${doc.title || "Untitled"}\n`;
  if (doc.article_number) text += `Article Number: ${doc.article_number}\n`;
  if (doc.library_key) text += `Library Scope / Division: ${String(doc.library_key).toUpperCase()}\n`;
  if (doc.slug) text += `Slug: ${doc.slug}\n`;

  if (entries && entries.length > 0) {
    text += "\n--- ARTICLES & REGULATION ENTRIES ---\n";
    text += entries.map((e, idx) => {
      const heading = e.label || e.anchor || `Clause ${idx + 1}`;
      let block = `### ${heading}\n${e.body || ""}`;
      if (Array.isArray(e.sub_clauses) && e.sub_clauses.length > 0) {
        block += "\n" + e.sub_clauses.map(sc => `- ${typeof sc === "string" ? sc : sc.text || sc.content || JSON.stringify(sc)}`).join("\n");
      }
      return block;
    }).join("\n\n");
  } else {
    text += "\n(No detailed sub-clauses registered for this document)";
  }

  return text.trim();
}

async function searchLibraryRegulations(queryStr, libraryKeyFilter) {
  const cleanQuery = sanitizeQueryForSearch(queryStr);
  const tokens = extractSearchTokens(cleanQuery);

  let query = "library_documents?select=id,library_key,slug,article_number,title,status,display_order&order=display_order.asc,created_at.asc";
  if (libraryKeyFilter) {
    query += `&library_key=eq.${encodeURIComponent(libraryKeyFilter)}`;
  }

  const documents = await supabaseRest(query).catch(() => []);
  if (!documents?.length) return [];

  const docIds = documents.map(d => encodeURIComponent(d.id));
  let entries = [];
  if (docIds.length > 0) {
    entries = await supabaseRest(
      `library_entries?document_id=in.(${docIds.join(",")})&select=id,document_id,anchor,label,body,sub_clauses,display_order&order=display_order.asc,created_at.asc`
    ).catch(() => []);
  }

  const entriesByDoc = new Map();
  for (const entry of (entries || [])) {
    const list = entriesByDoc.get(entry.document_id) || [];
    list.push(entry);
    entriesByDoc.set(entry.document_id, list);
  }

  const allDocs = documents.map(doc => {
    const docEntries = entriesByDoc.get(doc.id) || [];
    return {
      id: doc.id,
      title: doc.title || "Untitled Regulation",
      libraryKey: doc.library_key || "General",
      articleNumber: doc.article_number || "",
      slug: doc.slug || "",
      status: doc.status || "PUBLISHED",
      entriesCount: docEntries.length,
      content: formatLibraryDocument(doc, docEntries)
    };
  });

  if (!cleanQuery) {
    return allDocs.slice(0, 8);
  }

  const scored = allDocs.map(doc => {
    let score = 0;
    const titleLower = String(doc.title || "").toLowerCase();
    const articleLower = String(doc.articleNumber || "").toLowerCase();
    const slugLower = String(doc.slug || "").toLowerCase();
    const keyLower = String(doc.libraryKey || "").toLowerCase();
    const contentLower = String(doc.content || "").toLowerCase();

    if (titleLower === cleanQuery || articleLower === cleanQuery) score += 300;
    else if (titleLower.includes(cleanQuery) || articleLower.includes(cleanQuery)) score += 150;
    else if (slugLower.includes(cleanQuery)) score += 100;

    for (const token of tokens) {
      if (articleLower.includes(token)) score += 50;
      if (titleLower.includes(token)) score += 40;
      if (keyLower.includes(token)) score += 20;
      if (contentLower.includes(token)) score += 5;
    }

    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const topMatches = scored.filter(item => item.score > 0).map(item => item.doc);
  return (topMatches.length > 0 ? topMatches : allDocs).slice(0, 6);
}

async function searchAllArchives(queryStr) {
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

  // 2. Hierarchy items (High Command, Dark Council, Divisions)
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
  const dbArticles = await supabaseRest("archive_articles?select=*&limit=30").catch(() => []);
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

  return uniqueDocs.slice(0, 4);
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

      return (powerbases || []).map(pb => ({
        id: pb.id,
        name: pb.name,
        description: pb.description || "No description.",
        tier: pb.tier,
        prestige: pb.prestige,
        leaderId: pb.leader_id,
        leaderName: userMap[pb.leader_id] || `Discord:<@${pb.leader_id}>`,
        status: pb.status || "ACTIVE",
        isSuddenDeath: Boolean(pb.is_sudden_death),
        memberCount: (pb.powerbase_members?.length || 0) + 1,
        members: (pb.powerbase_members || []).map(m => ({
          userId: m.user_id,
          name: userMap[m.user_id] || `Discord:<@${m.user_id}>`,
          role: m.role || "Apprentice"
        }))
      }));
    }

    if (toolName === "get_shift_totals") {
      const scope = args.scope || "all";
      const targetUser = String(args.user || args.username || "").trim();

      let query = "clock_shifts?select=discord_user_id,discord_username,roblox_username,duration_seconds,status,scope";
      if (scope !== "all") {
        query += `&scope=eq.${encodeURIComponent(scope)}`;
      }
      if (targetUser) {
        const encoded = encodeURIComponent(targetUser);
        query += `&or=(discord_user_id.eq.${encoded},roblox_username.ilike.*${encoded}*,discord_username.ilike.*${encoded}*)`;
      }

      const shifts = await supabaseRest(query).catch(() => []);
      const totalSeconds = shifts.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);

      return {
        userQuery: targetUser || "All Users",
        scope,
        totalShiftsLogged: shifts.length,
        totalHoursLogged: Math.round((totalSeconds / 3600) * 10) / 10,
        totalMinutesLogged: Math.round(totalSeconds / 60),
        activeShiftsCount: shifts.filter(s => s.status === "active").length
      };
    }

    if (toolName === "get_division_activity") {
      const div = String(args.division || "").toLowerCase().trim();
      const [roster, reports, inspections] = await Promise.all([
        fetchDivisionRoster(div).catch(() => []),
        supabaseRest(`weekly_reports?division=eq.${encodeURIComponent(div)}&order=created_at.desc&limit=3`).catch(() => []),
        supabaseRest(`inspections?division=eq.${encodeURIComponent(div)}&order=created_at.desc&limit=3`).catch(() => [])
      ]);

      return {
        division: div,
        rosterCount: roster.length,
        roster: roster.slice(0, 15),
        recentWeeklyReports: reports,
        recentInspections: inspections
      };
    }

    if (toolName === "get_council_floor") {
      const proposals = await supabaseRest("council_proposals?select=*,council_proposal_votes(*)&order=created_at.desc&limit=5").catch(() => []);
      return {
        totalProposals: proposals.length,
        proposals
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
    const activeName = activeUser.username || activeProfile.robloxId || "Holonet Operator";

    const systemPromptWithContext = `${SYSTEM_PROMPT}

SESSION CONTEXT:
- Connected User Name: ${activeName}`;

    let messages = [
      { role: "system", content: systemPromptWithContext },
      ...userMessages.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.content || "")
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
            content: `Transmission rate limit reached across all sub-processors. Subspace communications busy. Try again in ${timeStr}.`
          });
        }
        return NextResponse.json({
          role: "assistant",
          content: `TRANSMISSION ERROR: Holonet neural sub-processor returned error ${errInfo?.status || 500}.`
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

    return NextResponse.json({
      role: "assistant",
      content: finalContent || "H.O.L.O STATEMENT: Query logged. No response generated."
    });

  } catch (error) {
    console.error("AI Chat handler error:", error);
    return NextResponse.json({
      role: "assistant",
      content: `INTERNAL ERROR: Subspace transmission processing failed: ${error.message}`
    }, { status: 500 });
  }
}
