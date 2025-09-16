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
