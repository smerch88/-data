---
description: Roll back the latest migration batch
allowed-tools: Bash(npm run migrate:down:*), Bash(npm run migrate:status:*)
argument-hint: [--all to roll back everything]
---

Before rolling back, remind the user: rollback may destroy data in tables that get dropped.

If the argument is `--all`:
```
cd backend && npx knex --knexfile knexfile.ts migrate:rollback --all
```

Otherwise roll back one batch:
```
cd backend && npm run migrate:down
```

Show status afterward:
```
cd backend && npm run migrate:status
```

Arguments: $ARGUMENTS
