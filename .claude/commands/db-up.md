---
description: Bring up Postgres + pgAdmin in Docker
allowed-tools: Bash(docker compose up:*), Bash(docker compose ps:*)
---

Start the infrastructure:

```
docker compose up -d
```

Then show container status:

```
docker compose ps
```

Remind the user:
- Postgres: `localhost:5433` (credentials in `.env`)
- pgAdmin UI: http://localhost:5050 (credentials in `.env`; the "Local Postgres" server is pre-registered, password is entered on first connect)
