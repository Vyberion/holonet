import { executeLegacyHandler } from "../../../../../lib/legacy-api-adapter.js";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GALAXY_LFS_ASSET_BASE = "https://media.githubusercontent.com/media/Vyberion/holonet/main/public/assets/galaxy";

const PLANETS = new Set([
  "coruscant",
  "dantooine",
  "korriban",
  "mandalore",
  "nar-shaddaa",
  "ziost"
]);

const FILES = new Set([
  "bump.png",
  "bump-preview.png",
  "cloud-bump.png",
  "cloud-bump-preview.png",
  "cloud-color.png",
  "cloud-color-preview.png",
  "clouds.png",
  "clouds-preview.png",
  "diffuse.png",
  "diffuse-preview.png",
  "elevation.png",
  "elevation-preview.png",
  "lights.png",
  "lights-preview.png",
  "roughness.png",
  "roughness-preview.png",
  "specular.png",
  "specular-preview.png",
  "water.png",
  "water-preview.png"
]);

function cleanParam(value) {
  return String(value || "").trim().toLowerCase();
}

function notFound() {
  return Response.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
}

function redirectToTexture(url) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Galaxy-Texture-Source": "lfs-redirect"
    }
  });
}

export async function GET(_request, context) {
  const params = await Promise.resolve(context.params);
  const planet = cleanParam(params?.planet);
  const file = cleanParam(params?.file);

  if (!PLANETS.has(planet) || !FILES.has(file)) return notFound();

  return redirectToTexture(`${GALAXY_LFS_ASSET_BASE}/${planet}/${file}`);
}
