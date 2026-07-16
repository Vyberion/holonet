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

const allFiles = getFiles('src/app/api');
const routeFiles = allFiles.filter(f => f.endsWith('route.js'));

let fixedCount = 0;

for (const file of routeFiles) {
  let content = fs.readFileSync(file, 'utf-8');
  
  if (content.includes('getAuthContext(')) {
    if (!content.includes('getAuthContext') || !content.match(/import\s+{[^}]*getAuthContext[^}]*}\s+from\s+['"].*?['"]/)) {
      
      const importApiHelpersRegex = /import\s+{([^}]+)}\s+from\s+['"](.*api-helpers\.js)['"]/;
      const match = content.match(importApiHelpersRegex);
      
      if (match) {
        if (!match[1].includes('getAuthContext')) {
          const newImportBlock = match[1] + ', getAuthContext';
          content = content.replace(importApiHelpersRegex, `import {${newImportBlock}} from "${match[2]}"`);
          fs.writeFileSync(file, content);
          console.log(`Fixed missing getAuthContext import in ${file}`);
          fixedCount++;
        }
      } else {
        if (!content.includes('import { getAuthContext }')) {
           console.log(`Could not find where to add getAuthContext in ${file}`);
        }
      }
    }
  }
}

console.log(`Fixed ${fixedCount} files.`);
