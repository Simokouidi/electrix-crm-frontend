# Electrix CRM (Frontend + Server)

This workspace contains a Vite + React frontend and a small Express + Socket.IO TypeScript server under `server/` that talks to a MySQL database.

Quick start (local)

- Frontend: from project root run:

  npm install
  npm run dev

- Server: from `server/` run:

  cd server
  npm install
  npm run dev

Set `MYSQL_URL` in the `server/.env` or your environment to your MySQL connection. Example Railway internal URL:

  mysql://root:password@mysql.railway.internal:3306/railway

Notes
- The server validates available schema on startup (simple presence checks) and exposes REST endpoints under `/api/clients`, `/api/activities`, and `/api/users`.
- The frontend's store (`src/lib/store.tsx`) has been updated to fetch from the API and subscribe to real-time Socket.IO events (so UI updates when backend emits events).
- If the API is unavailable the frontend gracefully falls back to seeded in-memory data to allow offline or demo usage.

Security
- DO NOT commit production DB credentials to source control. Use environment variables in your CI/CD provider (Railway, Render, etc.).
# CRM Prototype

Prototype desktop web app built with React + TypeScript + Vite + Tailwind matching the requested lightweight CRM dashboard.

Quick start
- Install: npm install
- Dev: npm run dev

What I built
- Global Shell with left Sidebar (Dashboard, Clients, Activities, Settings)
- Dashboard page with 4 KPI cards and Activity feed
- Clients page with table and Add Client modal
- Activities page with list and Add Activity modal
- Settings page with Profile, Team Members, Appearance toggle, Data reset and Admin placeholder chip

Notes / Assumptions
- Uses Tailwind for styling and lucide-react for icons. Colors and spacing chosen to match spec closely.
- Data is in-memory (src/lib/store.tsx). Reset Demo Data restores seed data.

## Railway deployment (frontend + backend + MySQL)

1) Backend service (server directory)
  - Root Directory: `server`
  - Install: `npm ci`
  - Build: `npm run build`
  - Start: `npm start`
  - Env: set `DATABASE_URL` (mysql://user:pass@host:port/db) or provide the native vars `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`.
  - Optional: `ADMIN_NAME`, `ADMIN_PASSWORD`.

2) Frontend service (project root)
  - Install: `npm ci`
  - Build: `npm run build`
  - Start (preview): `npm run preview -- --host 0.0.0.0 --port $PORT`
  - Env: `VITE_API_BASE = https://<your-backend>.railway.app`

3) Verify
  - Backend: open `/health` → `{ ok: true }`
  - Frontend: Network calls should target `VITE_API_BASE` under `/api/*`.
