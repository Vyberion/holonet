import { getSessionUser, supabaseRest } from "../../../../modules/auth/session-store.js";
import { randomUUID } from "crypto";

export async function POST(req) {
  try {
    const session = await getSessionUser(req);
    
    if (!session?.authenticated || !session?.user?.roblox_username) {
      return new Response(JSON.stringify({ error: "You must be logged in to submit this form." }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const username = session.user.roblox_username;
    
    // Check if this user has already submitted the form
    const existing = await supabaseRest(`public_perception_responses?user_id=eq.${encodeURIComponent(username)}&select=id`);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "You have already submitted a response. Only one submission is allowed per person." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const payload = await req.json();

    if (!payload || typeof payload !== "object") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    payload.robloxUsername = username;

    const recordId = randomUUID();
    const now = new Date().toISOString();

    // Insert into supabase
    await supabaseRest("public_perception_responses", {
      method: "POST",
      body: JSON.stringify({
        id: recordId,
        user_id: username, // Saving the username instead of the ID as requested
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
