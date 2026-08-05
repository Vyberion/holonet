import { promises as fs } from 'fs';
import path from 'path';

async function walk(dir, fileList = []) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    const stat = await fs.stat(path.join(dir, file));
    if (stat.isDirectory()) {
      fileList = await walk(path.join(dir, file), fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const PERMISSIONS_EXPORTS = new Set([
  'canAccessAdmin', 'hasPermission', 'checkPageAccess', 'checkResourceWriteAccess', 'hasHighCommandAccess', 'canEditLibrary', 'canEditStatutes'
]);
const AUTH_CONTEXT_EXPORTS = new Set([
  'getAuthContext'
]);

async function main() {
  const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
  const files = await walk(apiDir);
  let changed = 0;

  for (const file of files) {
    let content = await fs.readFile(file, 'utf8');
    let hasChanges = false;

    // Regex to match imports from any path ending in api-helpers.js
    const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]*api-helpers\.js)['"];/g;
    
    content = content.replace(importRegex, (match, importsStr, importPath) => {
      // split by comma, trim whitespace
      const imports = importsStr.split(',').map(s => s.trim()).filter(Boolean);
      const apiHelpersImports = [];
      const permissionsImports = [];
      const authContextImports = [];

      for (const imp of imports) {
        if (PERMISSIONS_EXPORTS.has(imp)) {
          permissionsImports.push(imp);
        } else if (AUTH_CONTEXT_EXPORTS.has(imp)) {
          authContextImports.push(imp);
        } else {
          apiHelpersImports.push(imp);
        }
      }

      if (permissionsImports.length === 0 && authContextImports.length === 0) {
        return match; // no changes needed
      }

      hasChanges = true;
      const baseDir = path.dirname(importPath); // e.g. "../../../lib"
      // the modules dir is adjacent to src, so from lib it's "../modules"
      // wait, importPath might be "../../../lib/api-helpers.js". 
      // replace "lib" with "../modules"
      const modulesPath = importPath.replace(/\/lib\/api-helpers\.js$/, '/../modules');
      
      let newImportStr = '';
      if (apiHelpersImports.length > 0) {
        newImportStr += `import {\n  ${apiHelpersImports.join(', ')}\n} from "${importPath}";\n`;
      }
      if (permissionsImports.length > 0) {
        newImportStr += `import { ${permissionsImports.join(', ')} } from "${modulesPath}/auth/permissions.js";\n`;
      }
      if (authContextImports.length > 0) {
        newImportStr += `import { ${authContextImports.join(', ')} } from "${modulesPath}/auth/auth-context.js";\n`;
      }

      return newImportStr.trim();
    });

    if (hasChanges) {
      await fs.writeFile(file, content);
      console.log(`Updated ${file}`);
      changed++;
    }
  }

  console.log(`Updated ${changed} files.`);
}

main().catch(console.error);
