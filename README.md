# -data

Postgres у Docker + малий Node.js/TypeScript бекенд для API доступу + pgAdmin для редагування з браузера. Розробка ведеться через Claude Code (субагенти + слеш-команди).

## Що всередині

- **Postgres 16** — `localhost:5433` (порт 5433, бо на хості вже є локальний postgres на 5432; змінюється через `POSTGRES_PORT` в `.env`)
- **pgAdmin 4** — http://localhost:5050 (сервер "Local Postgres" попередньо підключений)
- **Backend** — Express + Knex + pg, TypeScript, `localhost:3000`
- **Knex міграції та seeds** — у `backend/migrations/` та `backend/seeds/`

## Старт за 30 секунд

```powershell
cp .env.example .env
cd backend; npm install; cd ..
docker compose up -d
cd backend; npm run migrate:up
```

Або з Claude Code: `/setup`.

## Через Claude Code

Інфраструктура:
- `/db-up`, `/db-down`, `/db-reset` (видаляє volume), `/db-logs`

Робота зі схемою:
- `/schema <опис>` — спроектувати таблиці (агент `schema-designer`)
- `/migrate-new <опис>` — створити міграцію (агент `db-migrator`)
- `/migrate-up`, `/migrate-down`, `/migrate-status`

Дані:
- `/seed-new <опис>`, `/seed`

API:
- `/route <ендпоінт>` — додати/змінити роут (агент `api-builder`)
- `/api-dev` — підняти бекенд у dev-режимі

Інспекція:
- `/inspect <питання>` — read-only запити до БД (агент `db-inspector`)

## Структура

```
.claude/
  agents/        ← schema-designer, db-migrator, api-builder, db-inspector
  commands/      ← слеш-команди
  settings.json  ← allowlist для часто-вживаних bash команд
backend/
  src/           ← express + knex
  migrations/    ← Knex міграції (.ts)
  seeds/         ← Knex seeds (.ts)
  knexfile.ts
docker-compose.yml
infra/pgadmin/servers.json
.env.example
CLAUDE.md        ← інструкція для Claude Code
```

## Конвенції

Деталі — у [CLAUDE.md](CLAUDE.md).

## Пам'ять для Claude

[docs/CLAUDE_NOTES.md](docs/CLAUDE_NOTES.md) — спільна пам'ять між сесіями. Туди записуються відкинуті підходи, переваги користувача та технічні пастки оточення. Кожна нова Claude-сесія читає цей файл і дописує туди (або через команду `/note <текст>`).

## Корисні URL

- API: http://localhost:3000 (`/health` для перевірки)
- pgAdmin: http://localhost:5050 — логін з `.env`, пароль до Postgres вводиться при першому коннекті
