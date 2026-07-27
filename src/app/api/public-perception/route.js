import { getSessionUser, supabaseRest } from "../../../../modules/auth/session-store.js";
import { randomUUID } from "crypto";

export async function POST(req) {
  try {
    const session = await getSessionUser(req);
    let userId = null;
    if (session?.authenticated && session?.user?.roblox_id) {
      userId = session.user.roblox_id;
    }

    const payload = await req.json();

    if (!payload || typeof payload !== "object") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Basic validation could be done here, but we will mostly rely on client side and let the DB take the JSONB
    const recordId = randomUUID();
    const now = new Date().toISOString();

    // Insert into supabase
    await supabaseRest("public_perception_responses", {
      method: "POST",
      body: JSON.stringify({
        id: recordId,
        user_id: userId,
        responses: payload,
        created_at: now
      })
    });

    return new Response(JSON.stringify({ success: true, id: recordId }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Failed to submit public perception form:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
