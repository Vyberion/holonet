import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GALAXY_LFS_ASSET_BASE = "https://media.githubusercontent.com/media/Vyberion/holonet/migration/public/assets/galaxy";
const GALAXY_TEXTURE_ROOT = path.join(process.cwd(), "public", "assets", "galaxy");

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

function cacheHeaders(source) {
  return {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": "image/png",
    "X-Galaxy-Texture-Source": source
  };
}

function cleanParam(value) {
  return String(value || "").trim().toLowerCase();
}

function notFound() {
  return Response.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
}

async function readLocalTexture(planet, file) {
  const localPath = path.join(GALAXY_TEXTURE_ROOT, planet, file);
  const rootWithSeparator = `${GALAXY_TEXTURE_ROOT}${path.sep}`;
  if (!localPath.startsWith(rootWithSeparator)) return null;

  try {
    return await readFile(localPath);
  } catch {
    return null;
  }
}

export async function GET(_request, context) {
  const params = await Promise.resolve(context.params);
  const planet = cleanParam(params?.planet);
  const file = cleanParam(params?.file);

  if (!PLANETS.has(planet) || !FILES.has(file)) return notFound();

  const lfsUrl = `${GALAXY_LFS_ASSET_BASE}/${planet}/${file}`;
  try {
    const upstream = await fetch(lfsUrl, {
      cache: "force-cache",
      headers: {
        Accept: "image/png,image/*;q=0.9,*/*;q=0.5",
        "User-Agent": "holonet-galaxy-texture-loader"
      }
    });

    if (upstream.ok) {
      const bytes = await upstream.arrayBuffer();
      return new Response(bytes, { status: 200, headers: cacheHeaders("lfs") });
    }
  } catch {}

  const local = await readLocalTexture(planet, file);
  if (local) {
    return new Response(local, { status: 200, headers: cacheHeaders("local-fallback") });
  }

  return notFound();
}
