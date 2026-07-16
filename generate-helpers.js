import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const legacyPath = path.join(__dirname, 'src/lib/legacy-api-handlers.js');
const helpersPath = path.join(__dirname, 'src/lib/api-helpers.js');

const code = fs.readFileSync(legacyPath, 'utf-8');
const exportIdx = code.indexOf('export const LEGACY_API_HANDLERS = {');
if (exportIdx === -1) throw new Error("Could not find LEGACY_API_HANDLERS");

let helpersCode = code.substring(0, exportIdx);

const exportedNames = new Set();

// Replace and capture top-level definitions
helpersCode = helpersCode.replace(/^const ([a-zA-Z0-9_]+)\s*=/gm, (match, name) => {
  exportedNames.add(name);
  return `export const ${name} =`;
});

helpersCode = helpersCode.replace(/^let ([a-zA-Z0-9_]+)\s*=/gm, (match, name) => {
  exportedNames.add(name);
  return `export let ${name} =`;
});

helpersCode = helpersCode.replace(/^function ([a-zA-Z0-9_]+)\s*\(/gm, (match, name) => {
  exportedNames.add(name);
  return `export function ${name}(`;
});

// Capture imported names
const importRegex = /^import\s+(?:{\s*([^}]+)\s*}|([a-zA-Z0-9_]+))\s+from\s+['"][^'"]+['"];?/gm;
let match;
while ((match = importRegex.exec(helpersCode)) !== null) {
  if (match[1]) {
    // destructured imports
    const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
    names.forEach(n => exportedNames.add(n));
  } else if (match[2]) {
    // default import
    exportedNames.add(match[2]);
  }
}

// Add exports for the imported names
helpersCode += `\nexport { ${Array.from(exportedNames).join(', ')} };\n`;

fs.writeFileSync(helpersPath, helpersCode, 'utf-8');
console.log(`Generated api-helpers.js with ${exportedNames.size} exported names.`);
console.log(Array.from(exportedNames).join(', '));
