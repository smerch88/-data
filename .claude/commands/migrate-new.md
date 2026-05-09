---
description: Create a new Knex migration (delegates to db-migrator)
argument-hint: <description of the schema change>
---

The user wants to create a new migration. Description: **$ARGUMENTS**

Delegate this to the `db-migrator` subagent. Pass it:
- The user's description verbatim (above).
- Context: this project uses Knex with TypeScript, migrations live in `backend/migrations/`, the script `npm run migrate:make -- <name>` runs from the `backend/` directory.
- Instructions: create the file, fill in `up`/`down`, run `npm run typecheck`. Do NOT run `migrate:up` — the user will do that separately via `/migrate-up`.

If the description requires schema design (a new table, non-trivial relationships), first delegate to `schema-designer`, get the DDL plan, then pass that plan to `db-migrator`.
