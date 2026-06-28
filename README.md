# Holonet

Next.js app for the Holonet web interface and companion Discord bot.

## Commands

```bash
npm run dev
npm run build
npm run start
```

Bot commands live under `bot/`.

## OCI migration

The `migration` branch contains the OCI-ready web deployment setup.

```bash
cp .env.oci.example .env.local
npm run deploy:oci
```

Full instructions are in `docs/OCI_MIGRATION.md`.
