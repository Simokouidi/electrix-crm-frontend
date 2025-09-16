Deploying the whatsapp-web.js bot to a Linux VM (quick)

1) Provision a small VM (Ubuntu 22.04) with Docker or Node installed.

2) Option A — Docker (recommended):
   - Copy repo to VM or pull from git.
   - Ensure Docker is installed.
   - Set a strong BOT_API_KEY environment variable.
   - Run:
     ```bash
     mkdir -p ~/crm/whatsapp-data
     export BOT_API_KEY=replace-with-secret
     docker compose -f ./docker/docker-compose.whatsapp.yml up --build -d
     docker compose -f ./docker/docker-compose.whatsapp.yml logs -f whatsapp-bot
     ```
   - Scan the QR shown in the logs with your phone.

3) Option B — NodeJS (no Docker):
   - SSH to VM and install Node 18+.
   - Copy repository to `/opt/crm` and `cd /opt/crm`.
   - Create `/opt/crm/whatsapp-data` and ensure node can write to it.
   - Install deps:
     ```bash
     npm ci --production
     ```
   - Set environment variables and run with systemd (edit `systemd-whatsapp-bot.service` with your secret):
     ```bash
     sudo cp systemd-whatsapp-bot.service /etc/systemd/system/
     sudo systemctl daemon-reload
     sudo systemctl start systemd-whatsapp-bot
     sudo journalctl -u systemd-whatsapp-bot -f
     ```
   - Scan the QR shown in the journal logs on first run.

Notes
- Back up the `whatsapp-data` directory to avoid rescanning QR when reprovisioning.

Railway deployment notes
------------------------

If you want to deploy both the frontend and whatsapp-bot to Railway, follow these notes:

1. Frontend: deploy the `frontend` image or connect Railway to the repo and set build command `npm run build` and publish directory `dist`.
2. Bot: deploy the `whatsapp-bot` image or use Railway's Dockerfile detection. Ensure you add a Persistent Volume and mount it to `/app/.local-auth` (the bot uses LocalAuth in that path). Set `BOT_API_KEY` in Railway Environment variables.
3. Ensure the bot listens on `process.env.PORT` (already done). Configure CORS to only allow your frontend origin.

Using the provided GitHub Actions workflow will publish images to GHCR. In Railway you can create a new service from image `ghcr.io/<owner>/<repo>-whatsapp-bot:latest` and configure the volume mount and environment variables.

Local VS Code + Railway CLI quick setup
-------------------------------------

If you want to connect this repository from VS Code and deploy directly using the Railway CLI, follow these steps from your local machine (PowerShell):

1. Install Railway CLI (requires Node/npm):

```powershell
npm install -g @railway/cli
```

2. Log in from your machine (this opens a browser for authentication):

```powershell
railway login
```

3. From the repository folder, link or initialize a Railway project:

```powershell
cd 'C:\Users\HP\OneDrive - ELECTRIX\Desktop\CRM'
railway init   # create a new project or choose an existing one interactively
# or
railway link   # link to an existing Railway project
```

4. Create two services in Railway (via the dashboard or CLI):
  - `frontend` (static site): Connect the same repo and set build command `npm run build` and publish directory `dist`, or point it to the `docker/frontend.Dockerfile` image.
  - `whatsapp-bot` (Node service): Use Railway's Dockerfile detection or deploy using the `docker/whatsapp-bot.Dockerfile` image.

5. Add environment variables for the bot in Railway project settings (never commit these to git):
  - `BOT_API_KEY` (required by the bot API)
  - (optional) `PORT`, `WHATSAPP_PHONE_ID`, etc.

6. Add a persistent volume to the `whatsapp-bot` service and mount it to `/app/.local-auth` so the LocalAuth session persists across restarts.

7. Deploy from the CLI once linked:

```powershell
railway up
```

Railway CLI notes
------------------
- The `railway` CLI is interactive for `init`/`link` and will open a browser for login.
- You can also use `railway run` to run commands inside the linked project context.
- If you prefer GitHub-based deploys (recommended), connect GitHub to Railway in the Railway dashboard and enable automatic deploys.

Repository helper scripts
------------------------
I added a small PowerShell helper script `scripts/railway-setup.ps1` to help install the CLI and run the common link/deploy commands interactively. Run it from VS Code's integrated PowerShell terminal.

- Protect the bot API with strong BOT_API_KEY and network rules.
- This method is unofficial; for production use the Cloud API.
