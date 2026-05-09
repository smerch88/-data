---
description: Run a read-only DB inspection (delegates to db-inspector)
argument-hint: <question or SQL query>
---

The user wants to inspect the database in read-only mode: **$ARGUMENTS**

Delegate to the `db-inspector` subagent. It has access to `psql` via `docker compose exec postgres` and runs only SELECT / EXPLAIN / introspection.

If the request is a mutation (INSERT/UPDATE/ALTER/DROP/etc.), `db-inspector` must refuse and redirect the user to `/migrate-new`.
