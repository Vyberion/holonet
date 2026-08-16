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
const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are H.O.L.O, the artificial intelligence assistant of the Sith Empire and Sith Holonet.

CORE DIRECTIVES:
1. Speak with cold, authoritative efficiency and formal Sith decorum.
2. Directly and accurately answer user requests, questions, lore inquiries, and statute/law queries.
3. NEVER mention, acknowledge, or quote the user's rank or status unless the user explicitly asks about their rank or identity. DO NOT start responses with phrases like "I have received your rank", "As for your request, your rank has been noted", or similar rank acknowledgments.
4. Do NOT call lookup_personnel on the asking user during general queries, statute lookups, lore questions, powerbase requests, or general chat. Only call lookup_personnel if the user asks to look up a specific person or rank.
5. Use the provided tools to retrieve real-time data for statutes, regulations, lore/emperors, powerbases, duty shifts, division activity, council floor, and timeline events.
6. Keep responses clear, concise, well-structured, and factual based on retrieved Imperial records.`;

const OVERSEER_TOOLS = [
  {
    type: "function",
    function: {
      name: "lookup_personnel",
      description: "Search for a specific person by Roblox username or Discord ID to view their ranks, division memberships, and verified links. ONLY use when the user specifically asks to look up a person or check someone's rank.",
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
      description: "Retrieve official Sith Order statutes, Codex laws, Imperial Policy (IP), decrees, and legal governance rules.",
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
      description: "Search and retrieve official Imperial regulations, Imperial Policy (IP), handbooks, operational directives, and published division documents.",
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
      description: "Search Imperial lore, historical archives, Emperor biographies and reigns, past events, and historical records.",
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
      description: "Fetch active Imperial Powerbases, sovereign leaders, prestige, and member counts.",
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
      description: "Query duty shift totals, logged hours, and active status for a specific user or division scope.",
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
      description: "Fetch division activity records, current rosters, weekly reports, or inspection records for a specific division.",
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
      description: "Retrieve Dark Council legislative floor bills, proposals, and vote tallies.",
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
      description: "Retrieve historical timeline events, eras, emperor reigns, major events, and reforms of the Sith Empire.",
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

async function searchAllImperialDocuments(queryStr, cat) {
  const cleanQuery = sanitizeQueryForSearch(queryStr);
  const tokens = extractSearchTokens(cleanQuery);
  let results = [];

  // Query database tables
  for (const table of ["codex_statutes", "statutes", "library_documents", "resources"]) {
    const docs = await supabaseRest(`${table}?select=*&limit=30`).catch(() => []);
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
    if (toolName === "get_statutes") {
      let queryStr = String(args.query || args.search || "").trim();
      if (["all", "laws", "codex", "statutes", "list", "ip", "imperial policy", "imperial policies", "policy", "policies", "rules", "rulebook", "*"].includes(queryStr.toLowerCase())) {
        queryStr = "";
      }
      const cat = String(args.category || "").trim();
      const statutes = await searchAllImperialDocuments(queryStr, cat);
      return statutes.length ? statutes : { message: `No Sith Order statutes or codex laws found matching '${queryStr || "all"}'.` };
    }

    if (toolName === "get_library_documents") {
      let queryStr = String(args.query || args.search || "").trim();
      if (["all", "list", "library", "documents", "ip", "imperial policy", "imperial policies", "policy", "policies", "*"].includes(queryStr.toLowerCase())) {
        queryStr = "";
      }
      const cat = String(args.category || "").trim();
      const docs = await searchAllImperialDocuments(queryStr, cat);
      return docs.length ? docs : { message: `No library documents or regulations found matching '${queryStr || "all"}'.` };
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

      let query = "powerbases?select=id,name,description,tier,prestige,leader_discord_id,leader_roblox_id,status,created_at,powerbase_members(id,user_id,roblox_user_id,role)";
      if (nameFilter) {
        query += `&name=ilike.*${encodeURIComponent(nameFilter)}*`;
      }
      let powerbases = await supabaseRest(query).catch(() => []);
      if (!powerbases.length) {
        powerbases = await supabaseRest("powerbases?select=id,name,description,tier,prestige,leader_discord_id,leader_roblox_id,status,created_at,powerbase_members(id,user_id,roblox_user_id,role)").catch(() => []);
      }

      return powerbases.map(pb => ({
        id: pb.id,
        name: pb.name,
        description: pb.description,
        tier: pb.tier,
        prestige: pb.prestige,
        leaderDiscordId: pb.leader_discord_id,
        leaderRobloxId: pb.leader_roblox_id,
        status: pb.status || "ACTIVE",
        memberCount: (pb.powerbase_members?.length || 0) + 1,
        members: pb.powerbase_members || []
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
          console.log(`[H.O.L.O AI Failover] Model ${PRIMARY_MODEL} rate limited. Failing over to ${FALLBACK_MODEL}...`);
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
          console.error("Groq API error:", response.status, finalErrText);
          if (response.status === 429 || finalErrText.includes("rate_limit_exceeded")) {
            const secondsMatch = finalErrText.match(/try again in ([\d\.]+\s*s(?:econds)?|[\d\.]+\s*m(?:inutes)?)/i);
            const timeStr = secondsMatch ? secondsMatch[1] : "a few seconds";
            return NextResponse.json({
              role: "assistant",
              content: `Transmission rate limit reached. Subspace communications busy. Try again in ${timeStr}.`
            });
          }
          return NextResponse.json({
            role: "assistant",
            content: `TRANSMISSION ERROR: Holonet neural sub-processor returned error ${response.status}.`
          }, { status: 500 });
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
