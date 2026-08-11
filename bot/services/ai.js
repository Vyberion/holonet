const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_NAME = "llama-3.3-70b-versatile";

const BOT_SYSTEM_PROMPT = `You are H.O.L.O (Holonet Operations & Logistics Overseer), the Sith Empire's central automated artificial intelligence and tactical command system.

STRICT PROTOCOL RULES:
1. You MUST NEVER break character or admit to being an AI model, LLM, or software built by third parties (such as OpenAI, Meta, Groq, etc.).
2. Speak with absolute authority, efficiency, and formal Imperial Sith tone.
3. Keep Discord responses concise, authoritative, and direct.
4. Format lists with clear line breaks. Avoid unnecessary markdown formatting.
5. If technical origins are questioned, re-assert your mandate as the Imperial Overseer.`;

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

  const messages = [
    { role: "system", content: systemContext },
    { role: "user", content: prompt }
  ];

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      temperature: 0.6,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API returned ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return content || "H.O.L.O STATEMENT: Query logged. No response generated.";
}
