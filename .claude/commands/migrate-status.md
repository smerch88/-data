---
description: Show migration status (applied / pending)
allowed-tools: Bash(npm run migrate:status:*), Bash(npm run migrate:list:*)
---

```
cd backend && npm run migrate:status
```

If the output is empty or a full list is needed:
```
cd backend && npm run migrate:list
```
