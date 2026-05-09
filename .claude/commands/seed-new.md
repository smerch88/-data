---
description: Create a new seed file (delegates to db-migrator)
argument-hint: <description of the data to seed>
---

The user wants to create a seed file. Description: **$ARGUMENTS**

Delegate to the `db-migrator` subagent:
- Create the file via `cd backend && npm run seed:make -- <name>`.
- Make the seed idempotent (clear before insert, or `ON CONFLICT DO NOTHING`).
- Do NOT run `seed:run` — the user will do that via `/seed`.

If the user attached a CSV/JSON or a large data block, ask `db-migrator` to save it to `backend/seeds/data/` and read from the file rather than inlining the rows.
