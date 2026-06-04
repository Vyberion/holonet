export default async function handler(req, res) {
  const { deviceId } = req.query;

  if (!deviceId) {
    return res.status(400).json({ error: 'Device tracking hash missing.' });
  }

  const clientID = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ROBLOX_REDIRECT_URI);
  
  // Scopes required to check your user's basic profile identity
  const scope = encodeURIComponent('openid profile');
  
  // We encrypt/pass the deviceId inside the state parameter
  const state = encodeURIComponent(deviceId);

  const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${state}`;

  return res.redirect(robloxAuthUrl);
}