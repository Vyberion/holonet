import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";


const handler = async (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Restricted Node - Sith Holonet</title>
  <style>
    html,
    body {
      background: #0e0000;
      margin: 0;
      min-height: 100%;
    }
  </style>
</head>
<body>
  <div style="min-height:100vh;display:grid;place-items:center;color:#ff3b4f;font-family:'Share Tech Mono',monospace;text-align:center;padding:24px;">
    <div>
      <h1 style="font-family:'Orbitron',sans-serif;letter-spacing:.2em;">[ RESTRICTED NODE ]</h1>
      <p style="letter-spacing:.12em;text-transform:uppercase;">ACCESS DENIED: RESOURCE UNKNOWN</p>
      <p><a href="/registry" style="color:#ff3b4f;text-decoration:none;border:1px solid currentColor;padding:10px 18px;display:inline-block;">GO BACK</a></p>
    </div>
  </div>
</body>
</html>`);
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
