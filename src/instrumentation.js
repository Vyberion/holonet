export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startInternalCron } = await import("./lib/cron-worker.js");
    startInternalCron();
  }
}
