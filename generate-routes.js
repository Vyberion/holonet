import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the generated helpers to get the exact export list
const helpersCode = fs.readFileSync(path.join(__dirname, 'src/lib/api-helpers.js'), 'utf-8');
const exportLine = helpersCode.split('\n').filter(line => line.startsWith('export {')).pop();
const exportedNames = exportLine.replace('export {', '').replace('};', '').trim();

// Import the legacy handlers
import { LEGACY_API_HANDLERS } from './src/lib/legacy-api-handlers.js';

const apiDir = path.join(__dirname, 'src', 'app', 'api');

for (const [routePath, handlerFn] of Object.entries(LEGACY_API_HANDLERS)) {
  const fullPath = path.join(apiDir, routePath, 'route.js');
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  const depth = routePath.split('/').length;
  // api is 2 levels deep from src/app, so src/app/api/auth/login is 4 levels deep from src.
  // Actually, routePath is 'auth/login' (depth 2). 
  // From src/app/api/auth/login to src is ../../../../ (4 up).
  // Then to lib is lib/legacy-api-adapter.js
  const relativePrefix = '../'.repeat(depth + 2); // from src/app/api/... to root of app is depth + 2 ?
  // Let's count:
  // src/app/api/auth/login/route.js
  // 1: login, 2: auth, 3: api, 4: app. So 4 up reaches `src`. Then `src/lib`.
  // Depth of 'auth/login' is 2. 2 + 2 = 4. Yes.
  
  let sourceCode = handlerFn.toString();
  
  const fileContent = `
import { executeLegacyHandler } from "${relativePrefix}lib/legacy-api-adapter.js";
import {
  ${exportedNames}
} from "${relativePrefix}lib/api-helpers.js";

const handler = ${sourceCode};

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
`;

  fs.writeFileSync(fullPath, fileContent.trim() + '\n', 'utf-8');
  console.log(`Created ${fullPath}`);
}
