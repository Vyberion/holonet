export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      ok: true,
      service: "holonet-web",
      status: "healthy",
      checkedAt: new Date().toISOString(),
      branch: process.env.HOLONET_DEPLOY_BRANCH || null
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
