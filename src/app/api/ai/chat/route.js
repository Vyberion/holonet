import { NextResponse } from "next/server";
import { getAuthContext } from "../../../../../modules/auth/auth-context.js";
import { checkPageAccess } from "../../../../../modules/auth/permissions.js";
import { supabaseRest } from "../../../../../modules/auth/session-store.js";
import {
  resolveUserByUsername,
  loadRobloxProfileSummary,
  ROBLOX_GROUPS,
  personnelLookupWarnings
} from "../../../../lib/api-helpers.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are H.O.L.O, an AI assistant for the Sith Empire.

GUIDELINES:
1. Speak with authority, efficiency, and a polite, formal Sith tone. Never break character.
2. Be helpful and conversational. Answer general questions, lore, or requests directly.
3. Use overseer tools when users ask for specific real-time data like personnel info, shift logs, powerbase rosters, or statutes.
4. Do not make up personnel ranks, shift totals, or user data. Query database tools when specific records are requested.
5. Keep responses concise, direct, and readable in plain text with clear line breaks.`;

const OVERSEER_TOOLS = [
  {
    type: "function",
    function: {
      name: "lookup_personnel",
      description: "Search for personnel by Roblox username or Discord ID.",
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
          query: { type: "string", description: "Search query, keyword, or IP number for statutes and codex laws" },
          category: { type: "string", description: "Category filter" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_library_documents",
      description: "Search and retrieve official Imperial regulations, Imperial Policy (IP), library documents, codex entries, handbooks, and operational directives.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query or keyword for regulations, IP, and library documents" },
          category: { type: "string", description: "Category filter" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_archives",
      description: "Search and retrieve Imperial lore, historical archives, Emperor entries, and historical records.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query or keyword for lore and historical archive articles" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_powerbases",
      description: "Fetch all active Imperial Powerbases, sovereign leaders, prestige, and member counts.",
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
          user: {
            type: "string",
            description: "Optional Roblox username or Discord ID of a specific user to query shift time for."
          },
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
      name: "lookup_roblox_user",
      description: "Search for a public Roblox user by username to retrieve their User ID, display name, and avatar details.",
      parameters: {
        type: "object",
        properties: { username: { type: "string" } },
        required: ["username"]
      }
    }
  }
];

async function executeToolCall(toolName, args, auth) {
  console.log(`[H.O.L.O AI Executing Tool] Function: ${toolName}`, args);
  try {
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

      const targetRobloxId = robloxUser?.id ? String(robloxUser.id) : isNumeric ? queryStr : "";
      const targetQuery = targetRobloxId ? encodeURIComponent(targetRobloxId) : encoded;

      const [dbUsers, discordUsers, links, shiftLogs] = await Promise.all([
        supabaseRest(isNumeric
          ? `users?or=(roblox_username.ilike.*${encoded}*,discord_id.eq.${encoded})&select=id,roblox_username,discord_id&limit=3`
          : `users?roblox_username=ilike.*${encoded}*&select=id,roblox_username,discord_id&limit=3`
        ).catch(() => []),
        supabaseRest(isNumeric
          ? `discord_users?or=(username.ilike.*${encoded}*,id.eq.${encoded})&select=id,username,global_name&limit=3`
          : `discord_users?username=ilike.*${encoded}*&select=id,username,global_name&limit=3`
        ).catch(() => []),
        targetRobloxId || isNumeric
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

    function formatStatuteText(st) {
      let text = `[DOCUMENT]: ${st.title || "Untitled Document"}\nCategory: ${st.category || "Imperial Decree"}\nSummary: ${st.summary || "None"}\n`;
      if (Array.isArray(st.sections)) {
        text += st.sections.slice(0, 5).map((s, idx) => `Section ${idx + 1} (${s.title || "Untitled"}): ${String(s.content || "").slice(0, 400)}`).join("\n");
      } else if (st.content) {
        text += `Content: ${String(st.content).slice(0, 800)}`;
      }
      return text;
    }

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

    async function fetchTheCodexApi() {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";
      let codexDocuments = [];

      // 1. Fetch from /api/codex/statutes API endpoint
      try {
        const res1 = await fetch(`${siteUrl}/api/codex/statutes`, { headers: { "Cache-Control": "no-cache" } });
        if (res1.ok) {
          const json1 = await res1.json();
          if (json1?.ok && Array.isArray(json1.data)) {
            codexDocuments.push(...json1.data);
          }
        }
      } catch (e) { }

      // 2. Fetch from /api/library?library=codex API endpoint
      try {
        const res2 = await fetch(`${siteUrl}/api/library?library=codex`, { headers: { "Cache-Control": "no-cache" } });
        if (res2.ok) {
          const json2 = await res2.json();
          if (json2?.ok && Array.isArray(json2.documents)) {
            codexDocuments.push(...json2.documents);
          }
        }
      } catch (e) { }

      if (!codexDocuments.length) {
        const fallback = await supabaseRest("codex_statutes?select=*&order=created_at.asc").catch(() => []);
        codexDocuments.push(...fallback);
      }

      return codexDocuments;
    }

    async function searchAllImperialDocuments(queryStr, cat) {
      const cleanQuery = String(queryStr || "").trim().toLowerCase();
      const tokens = extractSearchTokens(cleanQuery);
function sanitizeQueryForSearch(raw) {
  let s = String(raw || "").toLowerCase();
  s = s.replace(/<@!?\d+>/g, "");
  s = s.replace(/\b(yo|lad|bro|hey|hi|hello|whats|what is|tell me|show me|find|search|about|holo|please|can you|the)\b/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

async function searchAllImperialDocuments(queryStr, cat) {
  const cleanQuery = sanitizeQueryForSearch(queryStr);
  const tokens = extractSearchTokens(cleanQuery);
  let results = [];

  // 1. Fetch from official Codex API endpoints
  const codexRows = await fetchTheCodexApi();
  for (const st of codexRows) {
    results.push({
      id: st.id,
      title: st.title || st.name,
      category: st.category || "Codex",
      summary: st.summary || "",
      content: formatStatuteText(st),
      slug: st.slug || st.id
    });
  }

  // 2. Fetch statutes, library_documents, and archive_articles
  for (const table of ["statutes", "library_documents", "archive_articles"]) {
    const docs = await supabaseRest(`${table}?select=*&limit=10`).catch(() => []);
    for (const d of docs) {
      results.push({
        id: d.id,
        title: d.title || d.name || "Untitled",
        category: d.category || table,
        summary: d.summary || "",
        content: d.content || d.description || formatStatuteText(d),
        slug: d.slug || d.id
      });
    }
  }

  // 3. Filter in memory by cleanQuery and tokens
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

  // Strict cap to top 3 documents to avoid token bloat & 429 rate limits
  return uniqueDocs.slice(0, 3);
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
      const docs = await searchAllImperialDocuments(queryStr, "");
      return docs.length ? docs : { message: `No archive articles found matching '${queryStr || "all"}'.` };
    }

    if (toolName === "get_statutes") {
      let queryStr = String(args.query || args.search || "").trim();
      if (["all", "laws", "codex", "statutes", "list", "ip", "imperial policy", "imperial policies", "policy", "policies", "rules", "rulebook", "*"].includes(queryStr.toLowerCase())) {
        queryStr = "";
      }
      const cat = String(args.category || "").trim();
      const statutes = await searchAllImperialDocuments(queryStr, cat);
      return statutes.length ? statutes : { message: `No Sith Order statutes or codex laws found matching '${queryStr || "all"}'.` };
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

    return { error: `Tool ${toolName} is not recognized.` };
  } catch (err) {
    return { error: `Tool execution error: ${err.message}` };
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
    const activeDiscord = activeUser.discord_id || activeProfile.discordId || "Not Linked";
    const activeRank = activeProfile.highRank || "Member";

    const systemPromptWithContext = `${SYSTEM_PROMPT}

USER CONTEXT:
- User Name: ${activeName}`;

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
        // If PRIMARY_MODEL (3.3-70b) hits rate limit, failover to FALLBACK_MODEL (3.1-8b)
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
              content: `Transmission rate limit reached. Try again in ${timeStr}.`
            });
          }
          return NextResponse.json({
            role: "assistant",
            content: `COMMUNICATION BREACH: Sub-processor error ${response.status}.`
          });
        }
      }

      const result = await response.json();
      const choiceMessage = result.choices?.[0]?.message;
      if (!choiceMessage) break;

      // Intercept & parse XML tool call tags
      if (choiceMessage.content && (choiceMessage.content.includes("<tool_call>") || choiceMessage.content.includes("<function="))) {
        const contentStr = choiceMessage.content;
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
      }

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
      content: finalContent || "H.O.L.O STATEMENT: Transmission acknowledged, query logged."
    });
  } catch (err) {
    console.error("Overseer Chat Error:", err);
    return NextResponse.json({
      role: "assistant",
      content: "ALERT: H.O.L.O sub-processor encountered an internal exception."
    }, { status: 500 });
  }
}
