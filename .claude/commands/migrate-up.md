---
description: Apply all pending migrations
allowed-tools: Bash(npm run migrate:up:*), Bash(npm run migrate:status:*)
---

Run migrations from the `backend/` directory:

```
cd backend && npm run migrate:up
```

Then show the status:

```
cd backend && npm run migrate:status
```
