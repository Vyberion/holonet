const fs = require('fs');
const path = require('path');

// Get all exports from api-helpers.js
const apiHelpers = fs.readFileSync('./src/lib/api-helpers.js', 'utf8');
const exportMatch = apiHelpers.match(/export\s*\{([^}]+)\}/);
const availableExports = new Set();
if (exportMatch) {
  exportMatch[1].split(',').forEach(name => {
    const trimmed = name.trim();
    if (trimmed) availableExports.add(trimmed);
  });
}

function walkDir(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      files.push(...walkDir(full));
    } else if (entry === 'route.js') {
      files.push(full);
    }
  }
  return files;
}

const routes = walkDir('./src/app/api');

routes.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Get imported names
  const importedNames = new Set();
  const importRegex = /import\s*\{([^}]+)\}\s*from/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    match[1].split(',').forEach(name => {
      const trimmed = name.trim().split(/\s+as\s+/).pop().trim();
      if (trimmed) importedNames.add(trimmed);
    });
  }
  
  // Get locally defined names (functions, consts, lets, vars)
  const localNames = new Set();
  const localRegex = /(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  while ((match = localRegex.exec(content)) !== null) {
    localNames.add(match[1]);
  }
  
  // JS builtins and globals
  const builtins = new Set([
    'if','else','for','while','do','switch','case','try','catch','finally',
    'return','throw','new','typeof','void','delete','in','of',
    'function','class','const','let','var','import','export','default',
    'async','await','yield','require','console','JSON','String','Number',
    'Boolean','Array','Object','Date','Math','Buffer','RegExp','Error',
    'TypeError','Response','Promise','Set','Map','parseInt','parseFloat',
    'encodeURIComponent','decodeURIComponent','fetch','setTimeout',
    'setInterval','clearTimeout','clearInterval','process','URL',
    'isNaN','undefined','null','true','false','Infinity','NaN',
    'Symbol','BigInt','Proxy','Reflect','WeakMap','WeakSet',
    'Request','Headers','FormData','URLSearchParams','TextEncoder',
    'TextDecoder','AbortController','AbortSignal','Blob','File',
    'ReadableStream','WritableStream','TransformStream',
    'setImmediate','queueMicrotask','structuredClone','atob','btoa',
    'crypto','performance','navigator','globalThis'
  ]);
  
  // Find function calls that aren't imported or locally defined
  const callRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  const missing = new Set();
  while ((match = callRegex.exec(content)) !== null) {
    const name = match[1];
    if (!builtins.has(name) && !importedNames.has(name) && !localNames.has(name)) {
      // skip if preceded by . (method call) or inside a string/comment
      const before = content.substring(Math.max(0, match.index - 1), match.index);
      if (before === '.' || before === '"' || before === "'") continue;
      missing.add(name);
    }
  }
  
  // Also check variable references (not just calls)
  const varRefRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
  // We'll skip this for now and focus on function calls
  
  if (missing.size > 0) {
    const relPath = path.relative('.', file).replace(/\\/g, '/');
    console.log(`\nBROKEN: ${relPath}`);
    console.log(`  Missing: ${[...missing].join(', ')}`);
    
    // Check which ones are available in api-helpers
    const fixable = [...missing].filter(name => availableExports.has(name));
    if (fixable.length > 0) {
      console.log(`  Available in api-helpers: ${fixable.join(', ')}`);
    }
    const notInHelpers = [...missing].filter(name => !availableExports.has(name));
    if (notInHelpers.length > 0) {
      console.log(`  NOT in api-helpers: ${notInHelpers.join(', ')}`);
    }
  }
});

console.log('\n--- Done ---');
