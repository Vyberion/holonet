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

let markdown = "# API Helpers Import Summary\n\nHere is the complete list of all functions imported from `api-helpers.js` for every API route.\n\n";

for (const file of routeFiles) {
  let content = fs.readFileSync(file, 'utf-8');
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"][^'"]+api-helpers\.js['"];?/;
  const match = content.match(importRegex);
  
  if (match) {
    const imports = match[1].split(',').map(s => s.trim()).filter(Boolean);
    const shortPath = file.replace('src/app/', '');
    markdown += `### ${shortPath}\n`;
    for (const imp of imports) {
      markdown += `- \`${imp}\`\n`;
    }
    markdown += `\n`;
  }
}

fs.writeFileSync('C:/Users/Owen/.gemini/antigravity-ide/brain/46ef518a-e15b-47cd-bd74-3e9c050d987e/api_imports_summary.md', markdown);
console.log('Artifact created.');
