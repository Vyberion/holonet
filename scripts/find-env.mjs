import fs from "node:fs";
import path from "node:path";

function findFiles(dir, depth = 0) {
  if (depth > 5) return;
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          findFiles(full, depth + 1);
        } else if (f.includes(".env")) {
          console.log("FOUND ENV:", full);
        }
      } catch {}
    }
  } catch {}
}

console.log("Searching...");
findFiles("C:/Users/Owen/.gemini");
findFiles("C:/Users/Owen/Documents/Visual Studio Code/Holonet");
