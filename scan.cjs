const fs = require('fs');
const path = require('path');
const valid = new Set(['hasPermission', 'checkPageAccess', 'checkResourceWriteAccess', 'canEditLibrary', 'canEditStatutes', 'hasHighCommandAccess', 'canAccessAdmin']);
const invalid = [];

function scan(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.next') continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      scan(p);
    } else if (p.endsWith('.js') || p.endsWith('.jsx')) {
      const content = fs.readFileSync(p, 'utf8');
      const match = content.match(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*permissions\.js['"]/);
      if (match) {
        const imports = match[1].split(',').map(s => s.trim()).filter(s => s);
        for (const imp of imports) {
          if (!valid.has(imp)) {
            invalid.push({ file: p, imp });
          }
        }
      }
    }
  }
}
scan('c:\\\\Users\\\\Owen\\\\Documents\\\\Visual Studio Code\\\\Holonet');
console.table(invalid);
