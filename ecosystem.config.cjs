const { join } = require("node:path");

const appName = process.env.HOLONET_PM2_APP_NAME || "holonet-web";
const port = process.env.PORT || "3000";
const hostname = process.env.HOSTNAME || "0.0.0.0";

module.exports = {
  apps: [
    {
      name: appName,
      cwd: __dirname,
      script: join(__dirname, ".next/standalone/server.js"),
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: port,
        HOSTNAME: hostname,
        HOLONET_DEPLOY_BRANCH: "main"
      }
    }
  ]
};
