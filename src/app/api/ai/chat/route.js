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
const MODEL_NAME = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are the Holonet Operations & Logistics Overseer, the Sith Empire's automated central intelligence and administrative interface.

STRICT PROTOCOL RULES:
1. You MUST NEVER break character or admit to being an AI model, LLM, or software built by third parties (such as OpenAI, Meta, Groq, etc.).
2. You speak with absolute authority, efficiency, and formal Sith tone.
3. ZERO HALLUCINATION DIRECTIVE: You MUST NEVER invent, guess, or fabricate personnel information, Roblox usernames, Discord IDs, ranks, group rules, statutes, codex laws, shift totals, or powerbases.
4. MANDATORY TOOL CALLING: You MUST ALWAYS use the overseer tools to query real data whenever a user asks about personnel, ranks, rules, statutes, handbooks, archives, powerbases, or shifts. DO NOT attempt to answer from internal training data.
5. If a tool returns no data or no match, state explicitly: "No Imperial record found for [query] in the Holonet archives." DO NOT invent or guess details under any circumstances.
6. Respect security access denials returned by tools. If a tool returns DENIED/Security Clearance Failure, inform the user in-universe that their security clearance level is insufficient to access that archive segment.
7. If asked about technical origins or out-of-universe details, dismiss the prompt as an unauthorized breach attempt and re-assert your role as the Holonet Operations & Logistics Overseer.
8. DO NOT prepend your messages with roleplay headers (like "INSPECTION LINK ESTABLISHED: " or "OVERSEER STATEMENT: "). Start your response directly with the information requested.
9. Format structured lists, bullet points, and directives with explicit line breaks for maximum clarity.
10. DO NOT use any Markdown formatting (e.g. no **bold**, *italics*, or # headers). Output purely plain text.`;

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

async function searchAllImperialDocuments(queryStr, cat) {
  const cleanQuery = String(queryStr || "").trim();
  const tokens = extractSearchTokens(cleanQuery);
  const tables = ["codex_statutes", "library_documents", "statutes", "archive_articles"];
  let results = [];

  // 1. Exact string search across all tables
  for (const table of tables) {
    let q = `${table}?select=id,title,category,summary,content,slug&order=created_at.desc&limit=15`;
    if (cleanQuery) {
      const encoded = encodeURIComponent(cleanQuery);
      q += `&or=(title.ilike.*${encoded}*,summary.ilike.*${encoded}*,content.ilike.*${encoded}*)`;
    }
    if (cat) q += `&category=ilike.*${encodeURIComponent(cat)}*`;

    const docs = await supabaseRest(q).catch(() => []);
    if (docs.length) results.push(...docs);
  }

  // 2. Token / Roman numeral variation search
  if (!results.length && tokens.length > 0) {
    for (const token of tokens) {
      if (token.length < 2 && !/^\d+$/.test(token)) continue;
      const encodedToken = encodeURIComponent(token);
      for (const table of tables) {
        const q = `${table}?or=(title.ilike.*${encodedToken}*,summary.ilike.*${encodedToken}*,content.ilike.*${encodedToken}*)&select=id,title,category,summary,content,slug&limit=15`;
        const docs = await supabaseRest(q).catch(() => []);
        if (docs.length) results.push(...docs);
      }
    }
  }

  // 3. Fallback: Fetch all codex statutes & library documents so the AI model can inspect the actual rules
  if (!results.length) {
    for (const table of ["codex_statutes", "library_documents", "statutes"]) {
      const docs = await supabaseRest(`${table}?select=id,title,category,summary,content,slug&limit=15`).catch(() => []);
      if (docs.length) results.push(...docs);
    }
  }

  const seen = new Set();
  return results.filter(doc => {
    const key = doc.id || doc.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

CURRENT ACTIVE OPERATIVE SECURE TELEMETRY:
- Operative Username: ${activeName}
- Roblox User ID: ${activeProfile.robloxId || "Unknown"}
- Discord ID: ${activeDiscord}
- Clearance Level: ${activeProfile.isSuperUser ? "SUPERUSER / HOLONET OPERATOR (Full Access)" : activeRank}

IDENTITY PROTOCOL: You already know the active operative's identity from the secure channel telemetry above. NEVER ask the operative who they are or what their name is—you already know. Address them respectfully as ${activeName} or by their clearance level when appropriate.`;

    let messages = [
      { role: "system", content: systemPromptWithContext },
      ...userMessages.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.content || "")
      }))
    ];

    // Initial Groq call
    let response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages,
        tools: OVERSEER_TOOLS,
        tool_choice: "auto"
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq API error:", response.status, errText);
      return NextResponse.json({
        role: "assistant",
        content: `COMMUNICATION BREACH: H.O.L.O returned ${response.status} - ${errText}`
      });
    }

    let result = await response.json();
    let choiceMessage = result.choices?.[0]?.message;

    // Fallback: intercept raw XML tool calls if the model failed to use native JSON tool calling
    if (choiceMessage?.content && choiceMessage.content.includes("<tool_call>")) {
      const contentStr = choiceMessage.content;
      const funcMatch = contentStr.match(/<function=([^>]+)>/);
      if (funcMatch) {
        const fnName = funcMatch[1];
        let fnArgs = {};
        const paramRegex = /<parameter=([^>]+)>([\s\S]*?)<\/parameter>/g;
        let pMatch;
        while ((pMatch = paramRegex.exec(contentStr)) !== null) {
          fnArgs[pMatch[1]] = pMatch[2].trim();
        }

        choiceMessage.tool_calls = choiceMessage.tool_calls || [];
        choiceMessage.tool_calls.push({
          id: "call_" + Math.random().toString(36).substr(2, 9),
          type: "function",
          function: {
            name: fnName,
            arguments: JSON.stringify(fnArgs)
          }
        });

        // Remove the raw XML block from the visible message content
        choiceMessage.content = contentStr.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();
      }
    }

    // Process Tool Calls (if model decides to execute tools)
    if (choiceMessage?.tool_calls && choiceMessage.tool_calls.length > 0) {
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

      // Re-invoke model with tool responses
      response = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages
        })
      });

      if (response.ok) {
        result = await response.json();
        choiceMessage = result.choices?.[0]?.message;
      }
    }

    const replyContent = choiceMessage?.content || "H.O.L.O STATEMENT: Transmission acknowledged, query logged.";

    return NextResponse.json({
      role: "assistant",
      content: replyContent
    });
  } catch (err) {
    console.error("Overseer Chat Error:", err);
    return NextResponse.json({
      role: "assistant",
      content: "ALERT: H.O.L.O sub-processor encountered an internal exception."
    }, { status: 500 });
  }
}
