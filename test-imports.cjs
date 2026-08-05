const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fileList = walk(fullPath, fileList);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const dirsToScan = [
  path.join(process.cwd(), 'src'),
  path.join(process.cwd(), 'modules')
];
let hasErrors = false;

for (const dir of dirsToScan) {
  const files = walk(dir);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const importRegex = /from\s+['"](.*(?:modules|lib)\/.*)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      let importPath = match[1];
      if (importPath.includes('legacy-api-adapter')) continue;
      
      const fileDir = path.dirname(file);
      const resolvedPath = path.resolve(fileDir, importPath);
      
      if (!fs.existsSync(resolvedPath)) {
        console.log('BROKEN IMPORT in ' + path.relative(process.cwd(), file));
        console.log('  Import: ' + importPath);
        console.log('  Resolved to: ' + resolvedPath);
        hasErrors = true;
      }
    }
  }
}

if (!hasErrors) {
  console.log('All local module/lib imports in src and modules resolve successfully!');
}
