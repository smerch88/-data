---
description: ⚠️ Wipe Postgres data (drop volume) and recreate the containers
allowed-tools: Bash(docker compose down:*), Bash(docker compose up:*), Bash(docker compose ps:*), Bash(docker volume:*)
argument-hint: [--force to skip confirmation]
---

WARNING: this command destroys all data in the database.

If the argument does NOT contain `--force`, ask the user for explicit confirmation first ("Are you sure? Data in volume `pgdata` will be lost. yes/no") and WAIT for the answer. Without an explicit "yes", abort.

After confirmation, run:

```
docker compose down -v
docker compose up -d
docker compose ps
```

Then remind the user to run migrations: `/migrate-up`.

Arguments: $ARGUMENTS
