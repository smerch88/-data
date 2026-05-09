---
description: Add or modify an HTTP endpoint (delegates to api-builder)
argument-hint: <method and path, what it returns, what it accepts>
---

The user wants to add/modify a route: **$ARGUMENTS**

Delegate to the `api-builder` subagent:
- Add or edit a file in `backend/src/routes/`.
- Mount the router in `backend/src/index.ts`.
- Run `npm run typecheck`.
- If the backend is running, smoke-test with curl and show the response.

If the route requires a schema change (new table/column), `api-builder` should stop and ask the user to run `/schema` + `/migrate-new` first.
