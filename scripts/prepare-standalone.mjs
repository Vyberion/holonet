import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const standaloneNextDir = path.join(standaloneDir, ".next");

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standaloneDir))) {
  throw new Error("Standalone output was not generated. Check next.config.mjs output: 'standalone'.");
}

const publicDir = path.join(root, "public");
if (await exists(publicDir)) {
  await cp(publicDir, path.join(standaloneDir, "public"), {
    recursive: true,
    force: true
  });
}

const staticDir = path.join(root, ".next", "static");
if (await exists(staticDir)) {
  await mkdir(standaloneNextDir, { recursive: true });
  await cp(staticDir, path.join(standaloneNextDir, "static"), {
    recursive: true,
    force: true
  });
}

console.log("Holonet standalone bundle is ready for OCI.");
