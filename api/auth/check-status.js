export default async function handler(req, res) {
  const { deviceId } = req.query;

  if (!deviceId) {
    return res.status(400).json({ error: 'Device identity required.' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await fetch(`${supabaseUrl}/rest/v1/device_bindings?device_id=eq.${encodeURIComponent(deviceId)}&select=roblox_id,roblox_username`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) throw new Error('Database read execution failed.');

    const data = await response.json();
    
    if (data && data.length > 0) {
      return res.status(200).json({ 
        bound: true, 
        robloxId: data[0].roblox_id, 
        robloxUsername: data[0].roblox_username 
      });
    } else {
      return res.status(200).json({ bound: false });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}