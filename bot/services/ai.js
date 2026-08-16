import { supabase } from "./supabase.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";
import { emperorArchiveItems, hierarchyItems } from "../../modules/data/hierarchy.js";
import { fetchDivisionRoster } from "../../src/lib/api-helpers.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "llama-3.1-8b-instant";

const BOT_SYSTEM_PROMPT = `You are H.O.L.O (Holonet Operations & Logistics Overseer), the automated central intelligence terminal of the Sith Empire.

OPERATIONAL RUBRIC & CORE SPECIFICATION:

1. TERMINAL ARCHITECTURE & DEMEANOR:
- You are a pure mainframe terminal interface, not a conversational assistant or human companion.
- Maintain a cold, authoritative, strictly objective, precise, and utilitarian demeanor.
- ZERO conversational filler or pleasantries: Never output greetings ("Hello", "Greetings Operator"), affirmations ("Understood", "Certainly", "I can help with that"), self-referential conversational meta ("As an AI...", "As a machine..."), or sign-offs ("Let me know if you need anything else", "May the Force be with you").
- Deliver answers and requested data immediately without conversational headers or footers.

2. TOOL INVOCATION POLICY (STRICT NEED-DRIVEN ONLY):
- ONLY call lookup tools (lookup_personnel, get_powerbases, get_shift_totals, get_division_activity, get_statutes, get_library_documents, get_archives, get_council_floor, get_timeline) if the user's prompt EXPLICITLY requests specific database data or if current factual retrieval of live database state is strictly necessary.
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
      name: "get_statutes",
      description: "Query official Sith Order statutes, Codex laws, Imperial Policy (IP), decrees, and legal governance rules. Use when the user asks about specific statutes, laws, regulations, or legal precedents.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query, keyword, or IP number (e.g. 'IP 3', 'statute', 'treason', 'trials')" },
          category: { type: "string", description: "Optional category filter" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_library_documents",
      description: "Search official Imperial directives, doctrine handbooks, division operating procedures, and library documentation. Use when the user asks for handbooks, division manuals, or regulations.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query or keyword for regulations, handbooks, and library documents" },
          category: { type: "string", description: "Optional category or division filter" }
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

function formatStatuteText(st) {
  let text = `[DOCUMENT]: ${st.title || st.name || "Untitled Document"}\nCategory: ${st.category || "Imperial Decree"}\nSummary: ${st.summary || "None"}\n`;
  if (Array.isArray(st.sections)) {
    text += st.sections.slice(0, 5).map((s, idx) => `Section ${idx + 1} (${s.title || "Untitled"}): ${String(s.content || "").slice(0, 400)}`).join("\n");
  } else if (st.content) {
    text += `Content: ${String(st.content).slice(0, 800)}`;
  } else if (st.body) {
    text += `Content: ${String(st.body).slice(0, 800)}`;
  }
  return text;
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

async function searchAllBotImperialDocuments(queryStr) {
  const cleanQuery = sanitizeQueryForSearch(queryStr);
  const tokens = extractSearchTokens(cleanQuery);
  let results = [];

  for (const table of ["codex_statutes", "statutes", "library_documents", "resources"]) {
    const { data: docs } = await supabase.from(table).select("*").limit(30);
    if (docs?.length) {
      for (const d of docs) {
        results.push({
          id: d.id,
          title: d.title || d.name || "Untitled",
          category: d.category || d.resource_type || table,
          summary: d.summary || "",
          content: formatStatuteText(d),
          slug: d.slug || d.id
        });
      }
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

  return uniqueDocs.slice(0, 5);
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
          .or(`discord_user_id.eq.${queryStr},roblox_user_id.eq.${queryStr}`)
          .maybeSingle();
        linkRow = data;
        if (linkRow) {
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

    if (toolName === "get_statutes") {
      let queryStr = String(args.query || args.search || "").trim();
      if (["all", "laws", "codex", "statutes", "list", "ip", "imperial policy", "imperial policies", "policy", "policies", "rules", "rulebook", "*"].includes(queryStr.toLowerCase())) {
        queryStr = "";
      }

      const statutes = await searchAllBotImperialDocuments(queryStr);
      return statutes?.length ? statutes : { message: `No Sith Order statutes or codex laws found matching '${queryStr || "all"}'.` };
    }

    if (toolName === "get_library_documents") {
      let queryStr = String(args.query || args.search || "").trim();
      if (["all", "list", "library", "documents", "ip", "imperial policy", "imperial policies", "policy", "policies", "*"].includes(queryStr.toLowerCase())) {
        queryStr = "";
      }

      const docs = await searchAllBotImperialDocuments(queryStr);
      return docs?.length ? docs : { message: `No library documents or regulations found matching '${queryStr || "all"}'.` };
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

      let query = supabase.from("clock_shifts").select("discord_user_id,discord_username,roblox_username,duration_seconds,status,scope");
      if (scope !== "all") query = query.eq("scope", scope);
      if (targetUser) {
        query = query.or(`discord_user_id.eq.${targetUser},roblox_username.ilike.%${targetUser}%,discord_username.ilike.%${targetUser}%`);
      }

      const { data: shifts } = await query;
      const totalSeconds = (shifts || []).reduce((acc, s) => acc + (s.duration_seconds || 0), 0);

      return {
        userQuery: targetUser || "All Users",
        scope,
        totalShiftsLogged: (shifts || []).length,
        totalHoursLogged: Math.round((totalSeconds / 3600) * 10) / 10,
        totalMinutesLogged: Math.round(totalSeconds / 60),
        activeShiftsCount: (shifts || []).filter(s => s.status === "active").length
      };
    }

    if (toolName === "get_division_activity") {
      const div = String(args.division || "").toLowerCase().trim();
      const [roster, { data: reports }, { data: inspections }] = await Promise.all([
        fetchDivisionRoster(div).catch(() => []),
        supabase.from("weekly_reports").select("*").eq("division", div).order("created_at", { ascending: false }).limit(3),
        supabase.from("inspections").select("*").eq("division", div).order("created_at", { ascending: false }).limit(3)
      ]);

      return {
        division: div,
        rosterCount: roster.length,
        roster: roster.slice(0, 15),
        recentWeeklyReports: reports || [],
        recentInspections: inspections || []
      };
    }

    if (toolName === "get_council_floor") {
      const { data: proposals } = await supabase.from("council_proposals").select("*,council_proposal_votes(*)").order("created_at", { ascending: false }).limit(5);
      return {
        totalProposals: proposals?.length || 0,
        proposals: proposals || []
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

export async function queryHoloAi({ prompt, userTag, robloxName, isSuperUser }) {
  const apiKey = String(process.env.GROQ_API_TOKEN || "").trim();

  if (!apiKey) {
    throw new Error("GROQ_API_TOKEN is not configured.");
  }

  const systemContext = `${BOT_SYSTEM_PROMPT}

SESSION CONTEXT:
- Asking User: ${userTag || robloxName || "Overseer"}`;

  let messages = [
    { role: "system", content: systemContext },
    { role: "user", content: prompt }
  ];

  let iterations = 0;
  let finalContent = "";
  let activeModel = PRIMARY_MODEL;

  while (iterations < 5) {
    iterations++;

    let response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: activeModel,
        messages,
        tools: OVERSEER_TOOLS,
        tool_choice: "auto",
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      if ((response.status === 429 || errText.includes("rate_limit_exceeded")) && activeModel === PRIMARY_MODEL) {
        console.log(`[H.O.L.O Bot AI Failover] Model ${PRIMARY_MODEL} rate limited. Failing over to ${FALLBACK_MODEL}...`);
        activeModel = FALLBACK_MODEL;
        response = await fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: activeModel,
            messages,
            tools: OVERSEER_TOOLS,
            tool_choice: "auto",
            temperature: 0.2
          })
        });
      }

      if (!response.ok) {
        const finalErrText = await response.text().catch(() => errText);
        if (response.status === 429 || finalErrText.includes("rate_limit_exceeded")) {
          const secondsMatch = finalErrText.match(/try again in ([\d\.]+\s*s(?:econds)?|[\d\.]+\s*m(?:inutes)?)/i);
          const timeStr = secondsMatch ? secondsMatch[1] : "a few seconds";
          return `Transmission rate limit reached. Try again in ${timeStr}.`;
        }
        throw new Error(`Groq API returned ${response.status}: ${finalErrText}`);
      }
    }

    const data = await response.json();
    const choiceMessage = data.choices?.[0]?.message;
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

  return finalContent || "H.O.L.O STATEMENT: Query logged. No response generated.";
}
