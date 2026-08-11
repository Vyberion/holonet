import { supabase } from "./supabase.js";
import { getVerifiedProfile } from "./roles.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_NAME = "llama-3.1-8b-instant";

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
        const { data } = await supabase.from("codex_statutes").select("*");
        if (data) codexDocuments.push(...data);
      }

      return codexDocuments;
    }

function sanitizeQueryForSearch(raw) {
  let s = String(raw || "").toLowerCase();
  s = s.replace(/<@!?\d+>/g, "");
  s = s.replace(/\b(yo|lad|bro|hey|hi|hello|whats|what is|tell me|show me|find|search|about|holo|please|can you|the)\b/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

async function searchAllBotImperialDocuments(queryStr) {
  const cleanQuery = sanitizeQueryForSearch(queryStr);
  const tokens = extractSearchTokens(cleanQuery);
  let results = [];

  // 1. Fetch from official Codex API endpoints
  const codexRows = await fetchTheCodexApi();
  if (codexRows?.length) {
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
  }

  // 2. Fetch statutes, library_documents, and archive_articles
  for (const table of ["statutes", "library_documents", "archive_articles"]) {
    const { data: docs } = await supabase.from(table).select("*").limit(10);
    if (docs?.length) {
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

      const articles = await searchAllBotImperialDocuments(queryStr);
      return articles?.length ? articles : { message: `No archive articles found matching '${queryStr || "all"}'.` };
    }

    if (toolName === "get_powerbases") {
      let nameFilter = String(args.name || args.query || "").trim();
      if (["all", "any", "list", "*", "undefined", "null"].includes(nameFilter.toLowerCase())) {
        nameFilter = "";
      }

      let query = supabase.from("powerbases").select("id,name,description,tier,prestige,leader_discord_id,leader_roblox_id,status,created_at,powerbase_members(id,user_id,roblox_user_id,role)");
      if (nameFilter) query = query.ilike("name", `%${nameFilter}%`);

      let { data: powerbases } = await query;
      if (!powerbases || !powerbases.length) {
        const { data: allPb } = await supabase.from("powerbases").select("id,name,description,tier,prestige,leader_discord_id,leader_roblox_id,status,created_at,powerbase_members(id,user_id,roblox_user_id,role)");
        powerbases = allPb || [];
      }

      return (powerbases || []).map(pb => ({
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
      .trim();
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

  let iterations = 0;
  let finalContent = "";

  while (iterations < 5) {
    iterations++;

    const response = await fetch(GROQ_ENDPOINT, {
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
      if (response.status === 429 || errText.includes("rate_limit_exceeded")) {
        const secondsMatch = errText.match(/try again in ([\d\.]+\s*s(?:econds)?|[\d\.]+\s*m(?:inutes)?)/i);
        const timeStr = secondsMatch ? secondsMatch[1] : "a few seconds";
        return `Transmission rate limit reached. Try again in ${timeStr}.`;
      }
      throw new Error(`Groq API returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const choiceMessage = data.choices?.[0]?.message;
    if (!choiceMessage) break;

    parseXmlToolCalls(choiceMessage);

    // Auto-trigger Codex tool call if prompt mentions codex/regulation/statute/ip and model didn't emit a tool call
    const lowerPrompt = String(prompt || "").toLowerCase();
    const codexKeywords = ["regulation", "regulations", "codex", "statute", "statutes", "policy", "ip ", "ip-", "law", "laws", "rule", "rules"];

    if (iterations === 1 && (!choiceMessage.tool_calls || choiceMessage.tool_calls.length === 0)) {
      if (codexKeywords.some(kw => lowerPrompt.includes(kw))) {
        console.log("[H.O.L.O Bot AI] Auto-triggering Codex lookup for prompt:", prompt);
        choiceMessage.tool_calls = [{
          id: "call_auto_" + Math.random().toString(36).substr(2, 9),
          type: "function",
          function: {
            name: "get_library_documents",
            arguments: JSON.stringify({ query: prompt })
          }
        }];
      }
    }

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
