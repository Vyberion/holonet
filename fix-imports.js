import { promises as fs } from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const MODULES_DIR = path.join(PROJECT_ROOT, 'modules');

async function walk(dir, fileList = []) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    // Ignore node_modules, .next, .git
    if (fullPath.includes('node_modules') || fullPath.includes('.next') || fullPath.includes('.git')) continue;
    
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      fileList = await walk(fullPath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function computeRelativeToModules(filePath) {
  const fileDir = path.dirname(filePath);
  let rel = path.relative(fileDir, MODULES_DIR).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

const PERMISSIONS_EXPORTS = new Set([
  'canAccessAdmin', 'hasPermission', 'checkPageAccess', 'checkResourceWriteAccess', 'hasHighCommandAccess', 'canEditLibrary', 'canEditStatutes'
]);
const AUTH_CONTEXT_EXPORTS = new Set([
  'getAuthContext'
]);
const SESSION_STORE_EXPORTS = new Set([
  'clearCookie', 'cleanupExpiredSessions', 'createRandomToken', 'createSessionForUser', 'createSignedStorageUrl', 'deleteSessionToken', 'getCookie', 'getSessionUser', 'listStorageObjects', 'removeStorageObjects', 'serializeCookie', 'SESSION_COOKIE', 'SESSION_MAX_AGE_SECONDS', 'STATE_COOKIE', 'supabaseRest', 'uploadStorageObject'
]);


async function main() {
  const dirsToScan = [path.join(PROJECT_ROOT, 'src'), path.join(PROJECT_ROOT, 'bot')];
  let files = [];
  for (const dir of dirsToScan) {
    files = await walk(dir, files);
  }
  let totalFixed = 0;

  for (const file of files) {
    let content = await fs.readFile(file, 'utf8');
    let hasChanges = false;
    const correctModulesPath = computeRelativeToModules(file);

    // 1. Fix incorrect api-helpers.js imports
    // Regex to match imports from any path ending in api-helpers.js
    const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]*api-helpers\.js)['"];/g;
    
    content = content.replace(importRegex, (match, importsStr, importPath) => {
      // split by comma, trim whitespace
      const imports = importsStr.split(',').map(s => s.trim()).filter(Boolean);
      const apiHelpersImports = [];
      const permissionsImports = [];
      const authContextImports = [];
      const sessionStoreImports = [];

      for (const imp of imports) {
        if (PERMISSIONS_EXPORTS.has(imp)) {
          permissionsImports.push(imp);
        } else if (AUTH_CONTEXT_EXPORTS.has(imp)) {
          authContextImports.push(imp);
        } else if (SESSION_STORE_EXPORTS.has(imp)) {
          sessionStoreImports.push(imp);
        } else {
          apiHelpersImports.push(imp);
        }
      }

      if (permissionsImports.length === 0 && authContextImports.length === 0 && sessionStoreImports.length === 0) {
        return match; // no changes needed
      }

      hasChanges = true;
      
      let newImportStr = '';
      if (apiHelpersImports.length > 0) {
        newImportStr += `import {\n  ${apiHelpersImports.join(', ')}\n} from "${importPath}";\n`;
      }
      if (permissionsImports.length > 0) {
        newImportStr += `import { ${permissionsImports.join(', ')} } from "${correctModulesPath}/auth/permissions.js";\n`;
      }
      if (authContextImports.length > 0) {
        newImportStr += `import { ${authContextImports.join(', ')} } from "${correctModulesPath}/auth/auth-context.js";\n`;
      }
      if (sessionStoreImports.length > 0) {
        newImportStr += `import { ${sessionStoreImports.join(', ')} } from "${correctModulesPath}/auth/session-store.js";\n`;
      }

      return newImportStr.trim();
    });

    if (hasChanges) {
      await fs.writeFile(file, content);
      console.log(`Updated ${path.relative(PROJECT_ROOT, file)}`);
      totalFixed++;
    }
  }

  console.log(`\nFixed ${totalFixed} files containing old api-helpers imports.`);
}

main().catch(console.error);
