export default async function handler(req, res) {
  const { code, state: deviceId, error } = req.query;

  if (error) {
    return res.redirect(`/account.html?status=error&msg=${encodeURIComponent(error)}`);
  }

  if (!code || !deviceId) {
    return res.redirect('/account.html?status=error&msg=Invalid+callback+payload');
  }

  try {
    // 1. Exchange access code for token from Roblox
    const tokenResponse = await fetch('https://apis.roblox.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.ROBLOX_CLIENT_ID,
        client_secret: process.env.ROBLOX_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.ROBLOX_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'Failed token transaction exchange');
    }

    // 2. Query Roblox UserInfo Endpoint for user profile details
    const userResponse = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userResponse.json();
    if (!userResponse.ok) {
      throw new Error('Could not fetch Roblox identity profile data.');
    }

    const robloxUid = userData.sub; // This is the user's stable Roblox UserID string

    // 3. Upsert device-to-roblox map mapping inside Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/device_bindings`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates' // Acts as an Upsert statement
      },
      body: JSON.stringify({
        device_id: deviceId,
        roblox_id: robloxUid
      })
    });

    if (!supabaseResponse.ok) {
      const dbErr = await supabaseResponse.text();
      console.error('Supabase Error:', dbErr);
      throw new Error('Database insertion failed.');
    }

    // 4. Send user back to client dashboard with confirmation keys
    return res.redirect(`/account.html?status=success&rblx=${robloxUid}`);

  } catch (err) {
    return res.redirect(`/account.html?status=error&msg=${encodeURIComponent(err.message)}`);
  }
}