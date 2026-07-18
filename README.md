# CraftDock

Lightweight self-hosted panel to manage a single Minecraft server (Java or Bedrock) via Docker.

## Prerequisites (deploy)

1. Minecraft service must set `OVERRIDE_SERVER_PROPERTIES=false`, else the Options tab won't persist.
2. Java servers: `ENABLE_RCON=true` + a shared `RCON_PASSWORD`.
3. Panel and MC server on the **same Docker network**.
4. The `mc-data` volume shared between panel and MC server.
5. Generate an admin password hash: `npm run hash -- <your-password>` → set as `ADMIN_PASSWORD_HASH`.
6. (Optional) Set `MAP_URL` for the Map tab; the map service must allow iframe embedding.

## Editions

- **Java** uses RCON — all player controls work (whitelist/ban/op/give/gamemode/kick/tp).
- **Bedrock** uses container stdin — `allowlist` instead of `whitelist`, and **ban/pardon are unavailable** (hidden in the UI).

## Development

```bash
cp .env.example .env   # fill ADMIN_PASSWORD_HASH, SESSION_SECRET, RCON_PASSWORD
npm install
npm test
npm run dev
```