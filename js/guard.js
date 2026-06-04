// Compatibility shim. New pages should load /modules/client/access-guard.js directly.
const script = document.createElement("script");
script.src = "/modules/client/access-guard.js";
document.head.appendChild(script);
