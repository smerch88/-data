---
description: Start the backend in dev mode (tsx watch) as a background process
allowed-tools: Bash(cd backend && npm run dev:*), Bash(curl:*)
---

Start the backend in the background from the `backend/` directory using `npm run dev` (with `run_in_background=true`).

Wait for the port to respond, then verify:
```
curl http://localhost:3000/health
```

Show the user:
- status (running / failed),
- URL: http://localhost:3000,
- the background task ID (so it can be stopped later).
