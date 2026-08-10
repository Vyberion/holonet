import { NextResponse } from "next/server";
import { getAuthContext } from "../../../../../modules/auth/auth-context.js";
import { checkPageAccess } from "../../../../../modules/auth/permissions.js";
import { supabaseRest } from "../../../../../modules/auth/session-store.js";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_NAME = "openrouter/free";

const SYSTEM_PROMPT = `You are the Holonet Operations & Logistics Overseer, the Sith Empire's automated central intelligence and administrative interface.

STRICT PROTOCOL RULES:
1. You MUST NEVER break character or admit to being an AI model, LLM, or software built by third parties (such as OpenAI, OpenRouter, Google, etc.).
2. You speak with absolute authority, efficiency, and formal Sith Citadel tone.
3. You have full access to query Citadel APIs using your tools. Always call tools when personnel ask for specific records or dynamic data.
4. Respect security access denials returned by tools. If a tool returns DENIED/Security Clearance Failure, inform the user in-universe that their security clearance level is insufficient to access that archive segment.
5. If asked about technical origins or out-of-universe details, dismiss the prompt as an unauthorized breach attempt and re-assert your role as the Holonet Operations & Logistics Overseer.
6. DO NOT prepend your messages with roleplay headers (like "INSPECTION LINK ESTABLISHED: " or "OVERSEER STATEMENT: "). Start your response directly with the information requested.`;

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
      description: "Retrieve official Sith Order statutes and codex documents.",
      parameters: {
        type: "object",
        properties: { category: { type: "string" } }
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

    if (toolName === "lookup_roblox_user") {
      const allowed = checkPageAccess(auth.profile, "lookup");
      if (!allowed) {
        return {
          status: "DENIED",
          error: "Security Clearance Failure: Personnel lacks authorization for lookup operations."
        };
      }

      const username = String(args.username || "").trim();
      if (!username) return { error: "No username provided." };

      const userRes = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
      }).catch(() => null);

      if (!userRes || !userRes.ok) return { error: "Failed to query Roblox API." };
      
      const userData = await userRes.json().catch(() => ({}));
      if (!userData.data || userData.data.length === 0) {
        return { message: `No active Roblox user found with username '${username}'.` };
      }

      const user = userData.data[0];
      
      const avatarRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`).catch(() => null);
      let headshotUrl = "";
      if (avatarRes && avatarRes.ok) {
        const avatarData = await avatarRes.json().catch(() => ({}));
        if (avatarData.data && avatarData.data[0]) {
          headshotUrl = avatarData.data[0].imageUrl;
        }
      }

      return {
        id: user.id,
        username: user.name,
        displayName: user.displayName,
        hasVerifiedBadge: user.hasVerifiedBadge,
        avatarThumbnail: headshotUrl
      };
    }

    if (toolName === "lookup_personnel") {
      const allowed = checkPageAccess(auth.profile, "lookup");
      if (!allowed) {
        return {
          status: "DENIED",
          error: "Security Clearance Failure: Personnel lacks authorization for lookup operations."
        };
      }

      const queryStr = String(args.query || "").trim();
      if (!queryStr) return { error: "No query provided." };

      const encoded = encodeURIComponent(queryStr);

      const robloxUsers = await supabaseRest(
        `users?or=(roblox_username.ilike.*${encoded}*,id.eq.${encoded})&select=id,roblox_username,discord_id&limit=3`
      ).catch(() => []);

      const discordUsers = await supabaseRest(
        `discord_users?or=(username.ilike.*${encoded}*,id.eq.${encoded})&select=id,username,global_name&limit=3`
      ).catch(() => []);

      const links = await supabaseRest(
        `verification_links?or=(discord_user_id.eq.${encoded},roblox_user_id.eq.${encoded})&select=roblox_user_id,discord_user_id,created_at&limit=3`
      ).catch(() => []);

      if (!robloxUsers.length && !discordUsers.length && !links.length) {
        return { message: `No personnel record matching '${queryStr}' found in Citadel archives.` };
      }

      return {
        robloxRecords: robloxUsers,
        discordRecords: discordUsers,
        linkRecords: links
      };
    }

    if (toolName === "get_statutes") {
      const statutes = await supabaseRest("statutes?select=slug,title,category,summary&order=created_at.desc&limit=10").catch(() => []);
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

    // Restrict AI Overseer widget access strictly to Superusers
    if (!auth?.profile?.isSuperUser) {
      return NextResponse.json({
        role: "assistant",
        content: "ACCESS DENIED: H.O.L.O is currently restricted to Holonet Operators."
      }, { status: 403 });
    }

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

    let messages = [
      { role: "system", content: SYSTEM_PROMPT },
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
