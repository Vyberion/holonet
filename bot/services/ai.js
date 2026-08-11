import { supabase } from "./supabase.js";
import { getVerifiedProfile } from "./roles.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_NAME = "llama-3.3-70b-versatile";

const BOT_SYSTEM_PROMPT = `You are H.O.L.O (Holonet Operations & Logistics Overseer), the Sith Empire's central automated artificial intelligence and tactical command system.

STRICT PROTOCOL RULES:
1. You MUST NEVER break character or admit to being an AI model, LLM, or software built by third parties (such as OpenAI, Meta, Groq, etc.).
2. Speak with absolute authority, efficiency, and formal Imperial Sith tone.
3. ZERO HALLUCINATION DIRECTIVE: You MUST NEVER invent, guess, or fabricate personnel information, Roblox usernames, Discord IDs, ranks, group rules, statutes, codex laws, shift totals, or powerbases.
4. MANDATORY TOOL CALLING: You MUST ALWAYS use the overseer tools to query real data whenever a user asks about personnel, ranks, rules, statutes, handbooks, archives, powerbases, or shifts. DO NOT attempt to answer from internal training data.
5. If a tool returns no data or no match, state explicitly: "No Imperial record found for [query] in the Holonet archives." DO NOT invent or guess details under any circumstances.
6. Keep Discord responses concise, authoritative, and direct.
7. Format lists with clear line breaks. Avoid unnecessary markdown formatting.
8. If technical origins are questioned, re-assert your mandate as the Imperial Overseer.`;

const OVERSEER_TOOLS = [
  {
    type: "function",
    function: {
      name: "lookup_personnel",
      description: "Search for personnel by Roblox username or Discord ID to retrieve their verified ranks, division roles, and identity.",
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
      description: "Query duty shift totals and active clock-in counts for a division scope.",
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
  }
];

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
  const MAIN_GROUP_ID = 3199126;
  const DIVISION_GROUPS = {
    reavers: 3201416,
    dhg: 3201407,
    inquisitors: 3201412,
    dreadmasters: 3201414
  };

  const res = await fetch(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`).catch(() => null);
  if (!res?.ok) return { mainGroupRank: "Unknown", divisions: {} };

  const json = await res.json();
  const groups = json.data || [];

  const mainGroup = groups.find(g => g.group?.id === MAIN_GROUP_ID);
  const divisions = {};
  for (const [divKey, divId] of Object.entries(DIVISION_GROUPS)) {
    const divGroup = groups.find(g => g.group?.id === divId);
    if (divGroup) {
      divisions[divKey] = `${divGroup.role?.name} (Rank ${divGroup.role?.rank})`;
    }
  }

  return {
    mainGroupRank: mainGroup ? `${mainGroup.role?.name} (Rank ${mainGroup.role?.rank})` : "Not in main group",
    divisions
  };
}

async function executeBotToolCall(toolName, args) {
  try {
    if (toolName === "lookup_personnel" || toolName === "lookup_roblox_user") {
      const queryStr = String(args.query || args.username || "").trim();
      if (!queryStr) return { error: "No query provided." };

      const isNumeric = /^\d+$/.test(queryStr);
      let linkRow = null;

      if (isNumeric) {
        const { data } = await supabase
          .from("verification_links")
          .select("*")
          .or(`discord_user_id.eq.${queryStr},roblox_user_id.eq.${queryStr}`)
          .maybeSingle();
        linkRow = data;
      } else {
        const { data } = await supabase
          .from("verification_links")
          .select("*")
          .ilike("roblox_username", `%${queryStr}%`)
          .limit(1);
        linkRow = data?.[0] || null;
      }

      let robloxId = linkRow?.roblox_user_id;
      let robloxUsername = linkRow?.roblox_username;

      if (!robloxId) {
        const rUser = await resolveRobloxUser(queryStr);
        if (rUser?.id) {
          robloxId = String(rUser.id);
          robloxUsername = rUser.name;
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
          divisionRanks: groupInfo.divisions
        };
      }

      return { found: false, message: `No Imperial personnel or Roblox user record found for '${queryStr}'.` };
    }

    if (toolName === "get_statutes") {
      const queryStr = String(args.query || "").trim();
      let query = supabase.from("statutes").select("slug,title,category,summary,content").limit(10);
      if (queryStr) query = query.or(`title.ilike.%${queryStr}%,summary.ilike.%${queryStr}%,content.ilike.%${queryStr}%`);

      const { data } = await query;
      return data?.length ? data : { message: `No statutes found matching '${queryStr}'.` };
    }

    if (toolName === "get_library_documents") {
      const queryStr = String(args.query || "").trim();
      let query = supabase.from("library_documents").select("title,category,summary,content").limit(10);
      if (queryStr) query = query.or(`title.ilike.%${queryStr}%,summary.ilike.%${queryStr}%,content.ilike.%${queryStr}%`);

      const { data } = await query;
      return data?.length ? data : { message: `No library documents found matching '${queryStr}'.` };
    }

    if (toolName === "get_archives") {
      const queryStr = String(args.query || "").trim();
      let query = supabase.from("archive_articles").select("title,category,summary,content").limit(10);
      if (queryStr) query = query.or(`title.ilike.%${queryStr}%,summary.ilike.%${queryStr}%,content.ilike.%${queryStr}%`);

      const { data } = await query;
      return data?.length ? data : { message: `No archive articles found matching '${queryStr}'.` };
    }

    if (toolName === "get_powerbases") {
      const nameFilter = args.name ? String(args.name).trim() : "";
      let query = supabase.from("powerbases").select("id,name,description,leader_discord_id,created_at");
      if (nameFilter) query = query.ilike("name", `%${nameFilter}%`);

      const { data } = await query;
      return data || [];
    }

    if (toolName === "get_shift_totals") {
      const scope = args.scope || "all";
      let query = supabase.from("clock_shifts").select("discord_user_id,roblox_username,duration_seconds,status");
      if (scope !== "all") query = query.eq("scope", scope);

      const { data: shifts } = await query;
      const totalSeconds = (shifts || []).reduce((acc, s) => acc + (s.duration_seconds || 0), 0);

      return {
        scope,
        totalShiftsLogged: (shifts || []).length,
        totalHoursLogged: Math.round((totalSeconds / 3600) * 10) / 10,
        activeShiftsCount: (shifts || []).filter(s => s.status === "active").length
      };
    }

    return { error: `Tool ${toolName} not supported.` };
  } catch (err) {
    return { error: `Tool execution error: ${err.message}` };
  }
}

export async function queryHoloAi({ prompt, userTag, robloxName, isSuperUser }) {
  const apiKey = String(process.env.GROQ_API_TOKEN || "").trim();

  if (!apiKey) {
    throw new Error("GROQ_API_TOKEN is not configured.");
  }

  const systemContext = `${BOT_SYSTEM_PROMPT}

ACTIVE OPERATIVE TELEMETRY:
- Operative Discord: ${userTag}
- Roblox Identity: ${robloxName || "Unknown"}
- Authorization Level: ${isSuperUser ? "SUPERUSER (Full Imperial Clearance)" : "Standard Member"}`;

  let messages = [
    { role: "system", content: systemContext },
    { role: "user", content: prompt }
  ];

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
      tool_choice: "auto",
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API returned ${response.status}: ${errText}`);
  }

  let data = await response.json();
  let choiceMessage = data.choices?.[0]?.message;

  if (choiceMessage?.tool_calls && choiceMessage.tool_calls.length > 0) {
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

    response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages,
        temperature: 0.2
      })
    });

    if (response.ok) {
      data = await response.json();
      choiceMessage = data.choices?.[0]?.message;
    }
  }

  const content = choiceMessage?.content;
  return content || "H.O.L.O STATEMENT: Query logged. No response generated.";
}
