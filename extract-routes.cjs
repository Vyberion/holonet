const fs = require('fs');
const code = fs.readFileSync('src/lib/legacy-api-handlers.js', 'utf-8');
const start = code.indexOf('export const LEGACY_API_HANDLERS = {');
const objStr = code.slice(start);
const lines = objStr.split('\n');
const keys = [];
for (const line of lines) {
  const match = line.match(/^\s+(?:"([^"]+)"|([a-zA-Z0-9_-]+)):\s*async/);
  if (match) {
    keys.push(match[1] || match[2]);
  }
}
console.log(JSON.stringify(keys, null, 2));
