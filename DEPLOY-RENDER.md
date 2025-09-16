Deploying the CRM to Render (static frontend + whatsapp-bot)
===============================================

This guide walks through deploying the CRM project to Render so the app runs entirely in the cloud (no VS Code needed). Render supports both static sites and web services and provides persistent disks for the bot's session data.

Prerequisites
- A Render account (https://render.com). You can sign up with GitHub and connect this repository.
- Branch in your repo to deploy (usually `main`).

Steps
1) Connect the repository
- Go to Render dashboard → New → Web Service (for bot) and Static Site (for frontend).
- When prompted, connect your GitHub account and grant access to the repository.

2) Frontend (Static Site)
- Create a new Static Site and choose branch `main`.
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Environment: Node
- Create the site — Render will build and publish the static frontend and provide a URL.

3) Bot (Web Service)
- Create a new Web Service and choose branch `main`.
- Environment: Node
- Build Command: `npm ci`
- Start Command: `node scripts/whatsapp-bot.js`
- Instance Type / Plan: choose based on your usage (start with free or standard)
- Add a Persistent Disk (Disk → Add Disk) and mount it to `/app/.local-auth` (this is required for LocalAuth session persistence).

4) Environment variables (Render Dashboard)
- In the Web Service settings (crm-whatsapp-bot), add the following environment variables:
  - `BOT_API_KEY` — (secret value)
  - `WHATSAPP_PHONE_ID` — (optional) if using Cloud API fallback
  - `PORT` — (optional) bot listens on `process.env.PORT` (default 3001 in our script)

5) Deploy & check logs
- After creating both services, Render will start the builds.
- Watch the bot's logs in Render; the bot should initialize and create files inside `/app/.local-auth` on disk. If you see QR display logs, open the bot's logs and scan the QR once unless LocalAuth previously exists.

6) Security
- The bot's HTTP API uses `BOT_API_KEY` in the request header — keep this secret.
- Optionally restrict inbound access via Render's firewall or set the service to not be publicly accessible and use Render's internal networking.

Backups
- Render disks are persisted but you may want to add a small job or script to periodically copy `/app/.local-auth` to S3/backup storage.

Notes
- The `render.yaml` manifest in the repo is a starting point; Render will read it if you use their Infrastructure as Code support. You can also configure everything via the dashboard.
- If you prefer Docker, Render supports deploying Docker containers as well (use the `docker/whatsapp-bot.Dockerfile`).

If you'd like, I can:
- Add a `render` workflow that automatically updates Render via API on push (requires `RENDER_API_KEY`), or
- Convert the bot to a container image and add a GitHub Actions workflow to push the image to GHCR and optionally trigger Render to pull it.
