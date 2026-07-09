let cronStarted = false;

export function startInternalCron() {
  if (cronStarted) return;
  cronStarted = true;

  console.log("[Holonet] Starting internal handbook refresh cron worker...");

  const refreshIntervalMs = 10 * 60 * 1000;

  async function runRefresh() {
    try {
      const port = process.env.PORT || "3000";
      const hostname = process.env.HOSTNAME || "127.0.0.1";
      // If bound to 0.0.0.0, we can't reliably fetch it via 0.0.0.0 in some environments. 
      // 127.0.0.1 is safer for loopback.
      const host = hostname === "0.0.0.0" ? "127.0.0.1" : hostname;
      const baseUrl = `http://${host}:${port}`;
      const cronSecret = process.env.CRON_SECRET || "";

      const response = await fetch(`${baseUrl}/api/cron/handbook-pdf-refresh`, {
        method: "GET",
        headers: {
          ...(cronSecret ? { "x-cron-secret": cronSecret } : {})
        }
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        console.log(`[Cron] Handbook refresh: Checked ${data.checked}, Refreshed ${data.refreshed}`);
      } else {
        console.error(`[Cron] Handbook refresh failed with status ${response.status}:`, data);
      }
    } catch (error) {
      console.error(`[Cron] Failed to execute handbook refresh loopback:`, error.message);
    }
  }

  // Allow the Next.js server time to fully boot up and bind to its port before pinging it
  setTimeout(() => runRefresh(), 15000);

  // Set up the persistent loop
  setInterval(() => runRefresh(), refreshIntervalMs);
}
