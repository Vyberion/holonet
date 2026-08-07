import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = path.resolve(__dirname, "../public/assets/archives");
const targetDir = path.resolve(baseDir, "archives");

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = fs.readdirSync(baseDir);
files.forEach(file => {
  const sourcePath = path.join(baseDir, file);
  if (file !== "archives" && fs.statSync(sourcePath).isFile()) {
    const destPath = path.join(targetDir, file);
    fs.renameSync(sourcePath, destPath);
    console.log(`Moved ${file} -> archives/${file}`);
  }
});
