---
description: Initial project setup (npm install + .env + docker compose up + migrations)
allowed-tools: Bash(cp:*), Bash(test:*), Bash(cd backend && npm install:*), Bash(docker compose:*), Bash(cd backend && npm run migrate:up:*), Bash(curl:*)
---

Run the initial setup:

1. If `.env` does not exist, copy from `.env.example`:
   - `test -f .env || cp .env.example .env`
2. Install backend dependencies:
   - `cd backend && npm install`
3. Bring up the containers:
   - `docker compose up -d`
4. Wait until postgres is healthy (check with `docker compose ps` until "healthy", or just sleep 3–5s and try migrations).
5. Run migrations:
   - `cd backend && npm run migrate:up`
6. Verify the DB responds:
   - `curl -fsS http://localhost:5050/misc/ping || true` (pgAdmin ping)
   - or start the backend `npm run dev` in the background and `curl http://localhost:3000/health`.

Report which steps succeeded and which failed.
