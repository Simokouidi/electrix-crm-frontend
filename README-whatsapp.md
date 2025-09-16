WhatsApp (whatsapp-web.js) local bot

This is a minimal local bot using whatsapp-web.js for testing. It's unofficial — it uses WhatsApp Web and requires scanning a QR code on first run.

Install and run

1. From the repo root:

```powershell
npm install whatsapp-web.js qrcode-terminal
npm run whatsapp-bot
```

2. On first run the terminal will show a QR. Scan it using WhatsApp on your phone (Linked devices -> Link a device).
3. The script sends a single test message and preserves session data using LocalAuth.

Security
- Do not commit the `*.local-auth` directory created by LocalAuth.
- This method is for testing only. For production use the official WhatsApp Cloud API.

Persistence / keep it running
- Linux/macOS: use pm2 to keep the bot running and restart on crash:

```bash
npm install -g pm2
pm2 start ./scripts/whatsapp-bot.js --name crm-whatsapp-bot
pm2 save
pm2 startup
```

- Windows: run the bot as a scheduled task or use NSSM to create a Windows service.

Session backup
- LocalAuth stores session files in a directory (e.g. `.local-auth` or `Local Storage`). Back up that folder to avoid rescanning the QR if the server is reprovisioned.

Security reminder
- Keep the LocalAuth directory private. If the session is leaked treat it like a compromised account and unlink devices from your phone.

Docker deployment (recommended for cloud)

1. Build and run (from repo root):

```bash
docker compose -f docker/docker-compose.whatsapp.yml up --build -d
```

2. The container maps a host folder `./whatsapp-data` to `/app/.local-auth` inside the container. This is where LocalAuth stores the session — keep it persistent and back it up.

3. Set the `BOT_API_KEY` environment variable (used to authorize calls to the bot API). Example using docker-compose env file or system env.

Send API example (from your app to the bot)

```
POST http://<bot-host>:3002/send
Headers: Authorization: Bearer <BOT_API_KEY>
Body: { "to": "85259849169", "message": "Hello from CRM app via bot" }
```

The bot will normalize the number and append `@c.us` before sending.

Note: On first container start the QR will be printed to the container logs — follow the logs and scan the QR once. Example:

```
docker compose -f docker/docker-compose.whatsapp.yml logs -f whatsapp-bot
```

