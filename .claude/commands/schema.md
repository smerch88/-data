---
description: Design tables / relationships (delegates to schema-designer; no files written)
argument-hint: <business description: entities, fields, relationships>
---

The user is describing entities for a DB schema: **$ARGUMENTS**

Delegate to `schema-designer`. It does NOT create migrations — it produces a DDL plan and an ER overview only.

Once the plan is ready and the user approves it, suggest running `/migrate-new <short description>` and pass the DDL plan into the next step's context.
