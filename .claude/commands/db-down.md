---
description: Stop Postgres + pgAdmin containers (volume data is preserved)
allowed-tools: Bash(docker compose down:*), Bash(docker compose ps:*)
---

Stop the infrastructure (volumes are preserved):

```
docker compose down
```

Confirm there are no running containers:

```
docker compose ps
```
