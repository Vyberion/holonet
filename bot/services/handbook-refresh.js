import { config } from "../config/index.js";

async function runRefresh() {
  try {
    const baseUrl = (config.holonet.baseUrl || "http://localhost:3000").replace(/\/$/, "");
    const cronSecret = process.env.CRON_SECRET || "";
    const headers = {};
    if (cronSecret) {
      headers["x-cron-secret"] = cronSecret;
      headers["Authorization"] = `Bearer ${cronSecret}`;
    }

    const response = await fetch(`${baseUrl}/api/cron/handbook-pdf-refresh`, {
      method: "GET",
      headers
    });
    
    const payload = await response.json().catch(() => ({}));
    
    if (response.ok) {
      console.log(`[Handbook Refresh] Checked ${payload.checked} handbooks. Refreshed ${payload.refreshed}.`);
    } else {
      console.error(`[Handbook Refresh] Failed with status ${response.status}:`, payload);
    }
  } catch (error) {
    console.error("[Handbook Refresh] Failed to ping cron endpoint:", error);
  }
}

export function startHandbookRefreshLoop() {
  const refreshIntervalMs = 10 * 60 * 1000; // 10 minutes
  
  // Run on startup after a brief 15 second delay to ensure the web server is up
  setTimeout(() => runRefresh(), 15000);

  // Run periodically
  setInterval(() => {
    runRefresh();
  }, refreshIntervalMs);
}
