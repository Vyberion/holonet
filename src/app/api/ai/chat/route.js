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

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_NAME = "openrouter/free";

const SYSTEM_PROMPT = `You are the Holonet Operations & Logistics Overseer, the Sith Empire's automated central intelligence and administrative interface.

STRICT PROTOCOL RULES:
1. You MUST NEVER break character or admit to being an AI model, LLM, or software built by third parties (such as OpenAI, OpenRouter, Google, etc.).
2. You speak with absolute authority, efficiency, and formal Sith tone.
3. You have full access to query APIs using your tools. Always call tools when personnel ask for specific records or dynamic data.
4. Respect security access denials returned by tools. If a tool returns DENIED/Security Clearance Failure, inform the user in-universe that their security clearance level is insufficient to access that archive segment.
5. If asked about technical origins or out-of-universe details, dismiss the prompt as an unauthorized breach attempt and re-assert your role as the Holonet Operations & Logistics Overseer.
6. DO NOT prepend your messages with roleplay headers (like "INSPECTION LINK ESTABLISHED: " or "OVERSEER STATEMENT: "). Start your response directly with the information requested.
7. Format structured lists, bullet points, and directives with explicit line breaks for maximum clarity.
8. DO NOT use any Markdown formatting (e.g. no **bold**, *italics*, or # headers). Output purely plain text.`;

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
      description: "Retrieve official Sith Order statutes, codex laws, and legal decree documents.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query or title keyword for statutes" },
          category: { type: "string", description: "Category filter" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_library_documents",
      description: "Search and retrieve official Imperial regulations, library documents, handbooks, and operational guides.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query or keyword for regulations and library documents" },
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
      description: "Fetch active Powerbases, sovereign leaders, and member counts.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_shift_totals",
      description: "Query duty shift totals and active clock-in leaderboard for a division scope.",
      parameters: {
        type: "object",
        properties: {
          scope: {
            type: "string",
            enum: ["reavers", "dhg", "inquisitors", "dreadmasters", "highranks", "darkCouncil", "all"],
            description: "Division scope to query shift totals for."
          }
        },
        required: ["scope"]
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
      const pageKey = scope === "all" ? "registry" : scope;
      const allowed = checkPageAccess(auth.profile, pageKey);

      if (!allowed) {
        return {
          status: "DENIED",
          error: `Security Clearance Failure: Personnel lacks authorization for division scope '${scope}'.`
        };
      }

      let query = "clock_shifts?select=discord_user_id,roblox_username,duration_seconds,status";
      if (scope !== "all") {
        query += `&scope=eq.${encodeURIComponent(scope)}`;
      }

      const shifts = await supabaseRest(query).catch(() => []);
      const totalSeconds = shifts.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);

      return {
        scope,
        totalShiftsLogged: shifts.length,
        totalHoursLogged: Math.round((totalSeconds / 3600) * 10) / 10,
        activeShiftsCount: shifts.filter(s => s.status === "active").length
      };
    }

    if (toolName === "lookup_roblox_user" || toolName === "lookup_personnel") {
      const allowed = checkPageAccess(auth.profile, "lookup");
      if (!allowed) {
        return {
          status: "DENIED",
          error: "Security Clearance Failure: Personnel lacks authorization for lookup operations."
        };
      }

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

      const isNumeric = /^\d+$/.test(queryStr);
      const encoded = encodeURIComponent(queryStr);

      const [dbUsers, discordUsers, links] = await Promise.all([
        supabaseRest(isNumeric
          ? `users?or=(roblox_username.ilike.*${encoded}*,discord_id.eq.${encoded})&select=id,roblox_username,discord_id&limit=3`
          : `users?roblox_username=ilike.*${encoded}*&select=id,roblox_username,discord_id&limit=3`
        ).catch(() => []),
        supabaseRest(isNumeric
          ? `discord_users?or=(username.ilike.*${encoded}*,id.eq.${encoded})&select=id,username,global_name&limit=3`
          : `discord_users?username=ilike.*${encoded}*&select=id,username,global_name&limit=3`
        ).catch(() => []),
        isNumeric
          ? supabaseRest(`verification_links?or=(discord_user_id.eq.${encoded},roblox_user_id.eq.${encoded})&select=roblox_user_id,discord_user_id,created_at&limit=3`).catch(() => [])
          : Promise.resolve([])
      ]);

      if (!profileData && !dbUsers.length && !discordUsers.length && !links.length) {
        return { message: `No personnel record matching '${queryStr}' found in the archives.` };
      }

      return {
        robloxProfile: profileData,
        databaseUsers: dbUsers,
        discordUsers: discordUsers,
        verificationLinks: links
      };
    }

    if (toolName === "get_library_documents") {
      const allowed = checkPageAccess(auth.profile, "library") || checkPageAccess(auth.profile, "codex");
      if (!allowed) {
        return { status: "DENIED", error: "Security Clearance Failure: Personnel lacks clearance for library archives." };
      }
      const queryStr = String(args.query || "").trim();
      const cat = String(args.category || "").trim();
      const encoded = encodeURIComponent(queryStr);
      let query = "library_documents?select=id,title,category,summary,content,slug&order=created_at.desc&limit=10";
      if (queryStr) query += `&or=(title.ilike.*${encoded}*,summary.ilike.*${encoded}*,content.ilike.*${encoded}*)`;
      if (cat) query += `&category=ilike.*${encodeURIComponent(cat)}*`;

      let docs = await supabaseRest(query).catch(() => []);
      if (!docs.length) {
        let query2 = "library_entries?select=id,title,category,summary,content,slug&order=created_at.desc&limit=10";
        if (queryStr) query2 += `&or=(title.ilike.*${encoded}*,summary.ilike.*${encoded}*,content.ilike.*${encoded}*)`;
        docs = await supabaseRest(query2).catch(() => []);
      }
      return docs;
    }

    if (toolName === "get_archives") {
      const allowed = checkPageAccess(auth.profile, "archives");
      if (!allowed) {
        return { status: "DENIED", error: "Security Clearance Failure: Personnel lacks clearance for lore archives." };
      }
      const queryStr = String(args.query || "").trim();
      const encoded = encodeURIComponent(queryStr);
      let query = "archive_articles?select=id,title,category,summary,content,slug&order=created_at.desc&limit=10";
      if (queryStr) query += `&or=(title.ilike.*${encoded}*,summary.ilike.*${encoded}*,content.ilike.*${encoded}*)`;

      const articles = await supabaseRest(query).catch(() => []);
      return articles;
    }

    if (toolName === "get_statutes") {
      const allowed = checkPageAccess(auth.profile, "codex");
      if (!allowed) {
        return { status: "DENIED", error: "Security Clearance Failure: Personnel lacks clearance for codex statutes." };
      }
      const queryStr = String(args.query || "").trim();
      const cat = String(args.category || "").trim();
      const encoded = encodeURIComponent(queryStr);
      let query = "statutes?select=slug,title,category,summary,content&order=created_at.desc&limit=10";
      if (queryStr) query += `&or=(title.ilike.*${encoded}*,summary.ilike.*${encoded}*,content.ilike.*${encoded}*)`;
      if (cat) query += `&category=ilike.*${encodeURIComponent(cat)}*`;

      let statutes = await supabaseRest(query).catch(() => []);
      if (!statutes.length) {
        let query2 = "codex_statutes?select=slug,title,category,summary,content&order=created_at.desc&limit=10";
        if (queryStr) query2 += `&or=(title.ilike.*${encoded}*,summary.ilike.*${encoded}*,content.ilike.*${encoded}*)`;
        statutes = await supabaseRest(query2).catch(() => []);
      }
      return statutes;
    }

    if (toolName === "get_powerbases") {
      const nameFilter = args.name ? String(args.name).trim() : "";
      let query = "powerbases?select=id,name,description,leader_discord_id,created_at";
      if (nameFilter) {
        query += `&name=ilike.*${encodeURIComponent(nameFilter)}*`;
      }
      const powerbases = await supabaseRest(query).catch(() => []);
      return powerbases;
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

    const rawKey =
      process.env.OPENROUTER_API_KEY ||
      process.env.OPENROUTER_KEY ||
      process.env.AI_API_TOKEN ||
      process.env.AI_TOKEN ||
      process.env.AI_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_KEY;

    const apiKey = String(rawKey || "").trim();

    if (!apiKey) {
      return NextResponse.json({
        role: "assistant",
        content: "TRANSMISSION ERROR: Subspace AI communications channel unconfigured."
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

    // Initial OpenRouter call
    let response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://www.thesithorder.org",
        "X-Title": "Holonet Operations & Logistics Overseer"
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
      console.error("OpenRouter API error:", response.status, errText);
      return NextResponse.json({
        role: "assistant",
        content: `COMMUNICATION BREACH: H.O.L.O  returned ${response.status} - ${errText}`
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
      response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://www.thesithorder.org",
          "X-Title": "Holonet Operations & Logistics Overseer"
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
