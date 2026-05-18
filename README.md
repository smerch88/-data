# Student Success Agent — AI Multi-Agent Student Retention Platform

> Зупиняємо відтік студентів до того, як вони морально пішли.

Онлайн-школи втрачають 30–50% студентів, не помічаючи 5–6 ранніх сигналів дропауту. Кожен втрачений студент — $1 848+ прямих збитків (CAC + недоотриманий LTV). **Student Success Agent** — мульти-агентна AI-система, що в реальному часі моніторить активність у LMS і Slack, виявляє студентів у групі ризику, пояснює причину і генерує персональну чернетку повідомлення для повернення.

## Продукт

**Для кого:** course manager / mentor онлайн-школи (GoIT, Hillel, Projector тощо), 100–5 000 активних студентів.

**Що робить:**
- Агент-Спостерігач — збирає сигнали: логіни, здача ДЗ, активність у чаті, оцінки
- Агент-Аналітик — оцінює ризик дропауту по кожному студенту, виявляє тренди
- Агент-Стратег — визначає пріоритет дій та стратегію втримання
- Агент-Комунікатор — генерує персональну чернетку повідомлення у tone-of-voice школи

**Ключові метрики:** 7–15% retention uplift з AI; <10% MOOC completion rate без інтервенції.

## Стек

| Шар | Технологія |
|---|---|
| AI-оркестрація | n8n + Claude API (Anthropic) |
| База даних | PostgreSQL 16 (Docker) |
| Backend API | Node.js / TypeScript / Express / Knex |
| DB-адмін | pgAdmin 4 |
| Дані для демо | OULAD dataset (Open University, CC BY 4.0) |
| Dev-середовище | Claude Code (субагенти + слеш-команди) |

## Швидкий старт

```bash
git clone https://github.com/smerch88/-data.git
cd -data
cp .env.example .env
docker compose up -d
cd backend && npm install
npm run migrate:up
npm run data:full        # завантаження OULAD → семпл → seed у БД
```

Після запуску:
- **API:** http://localhost:3000/health
- **pgAdmin:** http://localhost:5050 (логін з `.env`)

Детальний troubleshooting — нижче в розділі "Якщо щось пішло не так".

---

*Цей репозиторій — data-layer (Postgres + backend API). Продуктова концепція, архітектура агентів та емпіричний фундамент — у [docs/PROJECT_VISION.md](docs/PROJECT_VISION.md).*

---

## Що всередині

- **Postgres 16** — `localhost:5433` (порт 5433, бо на хості вже є локальний postgres на 5432; змінюється через `POSTGRES_PORT` в `.env`)
- **pgAdmin 4** — http://localhost:5050 (сервер "Local Postgres" попередньо підключений)
- **Backend** — Express + Knex + pg, TypeScript, `localhost:3000`
- **Knex міграції та seeds** — у `backend/migrations/` та `backend/seeds/`
- **OULAD dataset** — реальні дані Open University Learning Analytics (CC BY 4.0); раз-один тягнеться з figshare скриптом `data:download` (gitignored, 500 MB)

## Як підняти з нуля (clone → live demo)

```bash
git clone https://github.com/smerch88/-data.git
cd -data
cp .env.example .env
docker compose up -d
cd backend && npm install
npm run migrate:up
npm run data:full        # download OULAD → sample → seed
```

**Що робить `data:full`** (chain з трьох кроків):
1. **`data:download`** — тягне OULAD ZIP з figshare (47 MB, CC BY 4.0), перевіряє MD5, розпаковує 7 CSV у `data/oulad/`. Якщо CSV уже є — скіпає.
2. **`data:sample`** — читає CSV, семплює 15 студентів з AAA-2013J presentation у 4 demo-персони (HIGH_RISK / MEDIUM_RISK / PASS / FALSE_ALARM), генерує синтетичні Slack-повідомлення, пише `data/oulad/sample.json`.
3. **`seed:run`** — Knex seed файл [01_oulad_sample.ts](backend/seeds/01_oulad_sample.ts) завантажує `sample.json` у БД (3 mentors, 1 course, 15 students, 90 homework, 61 messages).

Усі три кроки **ідемпотентні** — повторний `npm run data:full` не качає, не семплить і не дублює, якщо стан незмінний.

**Альтернативно через Claude Code**: `/setup` (без OULAD-частини) → потім вручну `npm run data:full`.

### Швидкий smoke-test

```bash
# DB live
docker compose ps           # очікуємо app-postgres healthy
# Tables exist
docker compose exec postgres psql -U app -d appdb -c "\dt public.*"
# Data loaded
docker compose exec postgres psql -U app -d appdb -c "SELECT count(*) FROM students;"  # = 15
# pgAdmin UI
open http://localhost:5050  # або відкрити в браузері; логін з .env
# API
cd backend && npm run dev    # http://localhost:3000/health
```

### Якщо щось пішло не так

| Проблема | Рішення |
|---|---|
| Postgres не піднімається (port busy) | Змінити `POSTGRES_PORT` в `.env` (default 5433 щоб не конфліктувати з локальним 5432) |
| `npm run data:download` не може розпакувати ZIP | Перевір, чи є `unzip` (POSIX) або PowerShell (Windows). Скрипт пробує обидва. |
| Хочу почати з чистого листа | `/db-reset` (⚠️ wipe volume) → `npm run migrate:up` → `npm run data:full` |
| OULAD MD5 не сходиться | `rm data/oulad/anonymisedData.zip` → `npm run data:download` (перескачає) |

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
  migrations/    ← Knex міграції (.ts) — 5 таблиць EdTech retention схеми
  seeds/         ← Knex seeds (.ts) — завантажує OULAD-сампл
  knexfile.ts
data/oulad/      ← скрипти для тягання + семплу OULAD (raw CSV gitignored)
  download.js    ← idempotent figshare-fetcher
  sample.js      ← OULAD → 15 students × 4 personas → sample.json
  MAPPING.md     ← повний мапінг OULAD-схеми на нашу
docs/
  PROJECT_VISION.md   ← продуктова концепція + emпіричний фундамент
  proofs/             ← screenshots + цитати для всіх числових тверджень
  telegram/           ← експорт командного дискусу
tools/proof-researcher/  ← Patchright stealth screenshot-tool для верифікації цифр
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
