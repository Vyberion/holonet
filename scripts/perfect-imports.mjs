import fs from 'fs';
import path from 'path';

function getFiles(dir, files = []) {
  const fileList = fs.readdirSync(dir);
  for (const file of fileList) {
    const name = `${dir}/${file}`;
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else {
      files.push(name);
    }
  }
  return files;
}

const apiHelpersPath = 'src/lib/api-helpers.js';
const apiHelpersContent = fs.readFileSync(apiHelpersPath, 'utf-8');

const exportsSet = new Set();

// Extract from export { ... }
const exportMatch = apiHelpersContent.match(/export\s+{([^}]+)}/);
if (exportMatch) {
  const blockExports = exportMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
  for (const e of blockExports) {
    exportsSet.add(e);
  }
}

// Extract from export function/const/let/var/class X ...
const inlineRegex = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([a-zA-Z0-9_]+)/g;
let match;
while ((match = inlineRegex.exec(apiHelpersContent)) !== null) {
  exportsSet.add(match[1]);
}

const allExports = Array.from(exportsSet);

console.log(`Found ${allExports.length} total exports in api-helpers.js`);

const allFiles = getFiles('src/app/api');
const routeFiles = allFiles.filter(f => f.endsWith('route.js'));

let updated = 0;

for (const file of routeFiles) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // Replace ALL imports from api-helpers.js
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+api-helpers\.js)['"];?/g;
  let matches = [...content.matchAll(importRegex)];
  
  let importPath = null;
  if (matches.length > 0) {
    importPath = matches[0][2];
    content = content.replace(importRegex, '');
  } else {
    const depth = file.split('/').length - 2;
    importPath = '../'.repeat(depth) + 'lib/api-helpers.js';
  }

  const usedExports = [];
  for (const exp of allExports) {
    const regex = new RegExp(`\\b${exp}\\b`);
    if (regex.test(content)) {
      usedExports.push(exp);
    }
  }
  
  let newImport = '';
  if (usedExports.length > 0) {
    newImport = `import {\n  ${usedExports.join(', ')}\n} from "${importPath}";\n`;
  }

  if (content.includes('import { executeLegacyHandler }')) {
    content = content.replace(/(import { executeLegacyHandler }[^;]+;?\n)/, `$1${newImport}`);
  } else {
    content = newImport + content;
  }
  
  fs.writeFileSync(file, content);
  updated++;
}

console.log(`Updated ${updated} files.`);
