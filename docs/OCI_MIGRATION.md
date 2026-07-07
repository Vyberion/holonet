# OCI migration runbook

This branch is for running the Holonet web app on OCI.

The existing OCI bot can stay exactly where it is. Do not run these commands inside the `holonet-bot` directory. Use a separate checkout for the web app, for example `~/holonet-web`.

## What this branch adds

- Next.js standalone output for a smaller production server bundle.
- PM2 config for a separate process named `holonet-web`.
- A deployment script that pulls `migration`, installs dependencies, builds the app and reloads only `holonet-web`.
- A public health route at `/api/health`.
- `.env.oci.example` with the required runtime settings for OCI.

## First setup on the OCI instance

```bash
git clone -b migration git@github.com:Vyberion/holonet.git ~/holonet-web
cd ~/holonet-web
cp .env.oci.example .env.local
nano .env.local
```

Fill `.env.local` with the production values. At minimum, the web app needs:

```bash
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
NEXT_PUBLIC_SITE_URL=https://www.thesithorder.org
NEXT_PUBLIC_EMBED_ASSET_URL=https://www.thesithorder.org
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ROBLOX_CLIENT_ID=
ROBLOX_CLIENT_SECRET=
GOOGLE_SERVICE_ACCOUNT_JSON=
```

Register both Roblox OAuth callback URLs:

```text
https://www.thesithorder.org/api/auth/callback
https://thesithorder.org/api/auth/callback
```

Then deploy:

```bash
npm run deploy
```

That command reloads only the PM2 app named `holonet-web`, so it should not restart `holonet-bot`.

## Check the web app locally on OCI

```bash
pm2 list
pm2 logs holonet-web
curl -fsS http://127.0.0.1:3000/api/health
```

## Nginx reverse proxy

Use the actual domain you want OCI to serve.

```nginx
server {
    listen 80;
    server_name your-domain.example;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

After the Nginx file is enabled:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Then add HTTPS with Certbot if it is not already installed on the instance.

## OCI networking you must check

- OCI security list or network security group allows inbound `80` and `443`.
- Ubuntu firewall allows Nginx, usually `sudo ufw allow 'Nginx Full'` if UFW is enabled.
- Do not expose port `3000` publicly. Keep it behind Nginx.
- DNS `A` record points the OCI-served domain to the instance public IPv4.

## Updating later

From the web checkout:

```bash
cd ~/holonet-web
npm run deploy
```

## Optional handbook refresh cron later

Only add this when you want OCI to refresh cached handbook PDFs from cron.

```cron
*/30 * * * * curl -fsS -H "Authorization: Bearer replace-with-cron-secret" https://your-domain.example/api/cron/handbook-pdf-refresh >/dev/null 2>&1
```
