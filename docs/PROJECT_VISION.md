# EdTech Retention Platform — концепція і план

> Цей документ — продуктово-технічна основа для проекту, який команда готує на хакатон з дедлайном 18 травня 2026 і подальший розвиток у пілотний продукт. Будується поверх скелета з кореневого `CLAUDE.md` (Postgres + Node/TS бекенд) + n8n для AI-оркестрації. Майбутні сесії Claude Code мають читати цей файл перед прийняттям продуктових/архітектурних рішень.

## TL;DR для Claude

- **Що будуємо в хакатоні (10 днів)**: мульти-агентну AI-систему, що моніторить онлайн-школу через дані з LMS і Slack, виявляє учнів у ризику відтоку, пояснює причину, і генерує персональний message-draft для повернення. Multi-agent — це **архітектурне ядро**, без AI продукт не існує (відповідає критерію журі: AI-імплементація = 25% оцінки).
- **Кому продаємо**: українські онлайн-школи з 100–5000 активних учнів — GoIT, Hillel ([✓ verified](#proof-hillel-courses)), Projector, Prometheus, LearnLifeLong тощо. Кожен втрачений учень = $400–2000 доходу (на основі ринкових цін українських IT-курсів — див. [Hillel proof](#proof-hillel-courses) + 3-тижневе refund-вікно як direct revenue exposure школи) + репутаційні ризики.
- **Чому тільки multi-agent а не ML+LLM-гібрид**: команда з 7 людей, ~10 днів після роботи, обмежений ресурс на debug + data labeling. Multi-agent через n8n працює з першого дня без training data. ML-шар (XGBoost + SHAP як попередній фільтр перед агентами) свідомо **відкладений на post-hackathon roadmap** для оптимізації unit economics.
- **Що НЕ робимо в хакатоні**: класична ML-модель churn-prediction; survival analysis; uplift modeling; SHAP-feature attribution; production-ready scoring engine. Усе це в roadmap, але не в demo.

## 1. Концепція

### Проблема (з польової експертизи: Nadin — ментор GoIT)
Онлайн-школи фізично не можуть відстежити кожного учня. Ментор з 100–500 студентів помічає, що учень "відвалюється", уже постфактум — коли той пропустив 2–3 ДЗ, перестав заходити в LMS і не відповідає на повідомлення. Школа втрачає $400–2000 доходу за кожного, плюс репутацію через NPS і word-of-mouth.

### Job-to-be-done (для School / Course Manager)
> "Знайди мені 5–10 учнів, які зараз потребують уваги, поясни конкретно, в чому проблема кожного, і дай готову персональну дію — щоб я міг витратити 30 хвилин замість 3 годин і повернути учня **до того**, як він морально пішов."

### Ціннісна метрика
% зменшення [churn](#glossary-churn) або % збільшення [completion rate](#glossary-completion-rate). Все інше — proxy.

### Емпіричний baseline проблеми
- **MOOC median completion rate: 12.6%** (Jordan 2015 IRRODL, 221 курсів) — [✓ verified](#proof-jordan-2015-irrodl).
- **Distance education dropout: 30–50%** (US літературний consensus; Європа 20–30%; Азія до 50%) — [✓ verified](#proof-eric-distance-ed).
- **Online dropout vs offline: на 10–20% вищий, у деяких студіях — у 6–7 разів** (Christensen & Spackman 2017) — [✓ verified](#proof-eric-online-vs-offline).
- **Перші 1–2 тижні курсу — критичні**: після них активність stabilизується (різниця <3% у наступні тижні) — Jordan 2015. Це задає вікно для нашого моніторингу. Cross-confirm: Hillel [має refund-вікно 3 тижні](#proof-hillel-courses) — школи самі визнають критичність першого місяця.

### Чому AI multi-agent — це наукова база, не маркетинг

- **Bloom's 2-sigma problem (1984)** [✓ verified](#proof-bloom-2-sigma): персональне 1-on-1 tutoring піднімає середнього учня з 50-го перцентиля на 98-й (effect size **2.0σ**). Виклик Bloom-а: знайти scalable метод group instruction, що дорівнюватиме 1:1 tutoring. Multi-agent AI — наш підхід до цього.
- **Modern AI tutoring meta-analysis** [✓ verified](#proof-intelligent-tutoring-wiki): на 50 контрольованих exper-ів (Kulik & Fletcher 2015) ITS дають median effect size **0.66σ** (50-й → 75-й перцентиль), перемагаючи у 92% порівнянь.
- **VanLehn 2011**: модерні AI-tutors **статистично не відрізняються від expert human tutors**.
- **Реалістичний таргет нашого продукту**: 15–25% reduction in dropout у пілоті. Підстава: ES 0.66 (ITS meta-analysis) + 30–50% baseline dropout (ERIC) = математично 4.5–12.5 п.п. абсолютного зниження dropout.

## 2. Диференціація проти конкурентів

| Конкурент | Що робить | Чого НЕ робить (наша ніша) |
|---|---|---|
| Mixpanel / Amplitude / Heap | Generic product analytics, churn-дашборди | Не EdTech-aware, не пропонують intervention, тільки графіки |
| Gainsight, ChurnZero | Customer Success платформи з NLP/EBM-скорингом | Корпоративні, ціна непублічна — лише через "Contact Sales" ([✓ verified](#proof-gainsight-pricing)); не для онлайн-шкіл з 100–500 учнів |
| Вбудована аналітика Thinkific / Teachable / Kajabi | Метрики логінів, прогрес курсу | Базова, без розуміння причин, без AI-driven dії |
| Ручний моніторинг (Excel + Slack-нотатки ментора) | Все робиться руками | Не масштабується; школа з 1000+ учнів фізично не може відстежити кожного |

**Наша різниця**: ми не просто прогнозуємо ризик. Ми **пояснюємо причину** (через мульти-агентний аналіз чатів + LMS) і **генеруємо готову дію** (персональний message-draft у стилі школи). Інші показують графік — ми пишемо персональний лист тому, хто на межі.

## 3. Hackathon Scope — що саме розробляємо до 18 травня

**Це окрема секція, не roadmap.** Тут — точний перелік того, що буде у демо для журі. Решта (ML, uplift, інтеграції) — у roadmap нижче.

### Поточний стан (станом на 2026-05-09)

- ✅ **Інфраструктура** — Postgres + pgAdmin у Docker, Express+Knex backend skeleton, Next.js scaffold у roadmap.
- ✅ **БД схема** — 5 таблиць (mentors / courses / students / homework / slack_messages) через 5 Knex-міграцій.
- ✅ **Half-real mock data** — OULAD sample залитий: 3 mentors / 1 course / 15 students / 90 homework / 61 slack_messages.
- ✅ **Live deploy** — `https://db.my-own-testing.space` (pgAdmin за HTTPS через Caddy + Let's Encrypt/ZeroSSL, на VPS Arsenii). Backend + frontend пізніше на тому ж VPS.
- ✅ **Empirical foundation** — 18 верифікованих proofs у `docs/proofs/` (Bloom 2σ, ITS meta-analysis, Jordan 2015, OULAD, тощо).
- ⏳ **Multi-agent система** — 4 агенти в n8n (Спостерігач / Аналітик / Стратег / Комунікатор) — у роботі (Дмитро + Микола).
- ⏳ **Дашборд** — UX-дизайн (Гюльзар) → Next.js (Arsenii).
- ⏳ **Demo-story + презентація** — Еріка.

### Що показуємо на демо

1. **Дашборд** для School / Course Manager: список ризикових учнів, кольорові мітки, тренд за тиждень, KPI зверху.
2. **Профіль ризикового учня**: timeline активності + AI-пояснення ризику + рекомендована дія + готовий message-draft.
3. **Жива історія студента** (demo-story): один з 4 учнів (3 HIGH_RISK Withdrawn + 8 Pass + 3 Fail + 1 Distinction — реальні OULAD outcome categories) проходить весь flow — від тригера до відправленого листа.
4. **Архітектурний слайд** з 4 агентами в дії: видно, який агент що робить.
5. **Презентація** з аргументами проблеми (Jordan 2015, ERIC), конкурентами, монетизацією, roadmap пост-хакатона.

### Що НЕ показуємо (свідомо)

- ML churn-prediction модель (XGBoost / LightGBM).
- SHAP feature attribution.
- Survival analysis / uplift modeling.
- Реальну інтеграцію зі справжніми LMS / Slack.
- A/B testing engine.
- Self-serve onboarding.

### Технічний обсяг

- **n8n workflow з 4 агентами** (Спостерігач, Аналітик, Стратег, Комунікатор) + orchestrator.
- **Claude API** через особисту підписку Arsenii (~$10 видатків на демо).
- **Postgres БД** (скелет уже є, схема нижче в секції 5) з **гібридною mock-базою — half-real**.
- **Next.js дашборд** на frontend.
- **Express бекенд** (скелет є) з Knex.
- **Хост**: VPS Arsenii (deploy готовий — `https://db.my-own-testing.space` для pgAdmin).
- **Дані**: реальний датасет **[OULAD](https://doi.org/10.6084/m9.figshare.5081998)** (Kuzilek et al. 2017, Nature Sci Data, **CC BY 4.0**, 32k студентів × 22 module-presentations × 173k assessment submissions), сампл 15 студентів з module AAA-2013J + 90 реальних homework-submissions з реальними дедлайнами, оцінками, статусами. Поверх — **синтетичні Slack-повідомлення** (61 шт.), прив'язані детерміністично до реальних engagement-патернів (HIGH_RISK → "кину курс" + тиша; PASS → регулярні питання; FALSE_ALARM → calm одиничні відповіді ментору). Повний мапінг — [data/oulad/MAPPING.md](../data/oulad/MAPPING.md).

## 4. Архітектура — Multi-agent (Hackathon)

```
                    ┌───────────────────────┐
                    │  Дашборд (Next.js)    │
                    │  School Manager view  │
                    └─────────┬─────────────┘
                              │ REST API
                    ┌─────────▼─────────────┐
                    │  Express + Knex       │
                    │  Postgres (OULAD-real │
                    │  + synth Slack chat)  │
                    └─────────┬─────────────┘
                              │ webhook / scheduled
                    ┌─────────▼─────────────┐
                    │  n8n  Orchestrator    │
                    │  (Planner agent)      │
                    └─┬───┬───┬───┬─────────┘
                      │   │   │   │
        ┌─────────────┘   │   │   └────────────┐
        ▼                 ▼   ▼                ▼
 ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
 │ Спостерігач │  │  Аналітик   │  │  Стратег    │  │ Комунікатор │
 │             │  │             │  │             │  │             │
 │ Сканує      │  │ Збирає      │  │ Рекомендує  │  │ Генерує     │
 │ Slack-чати, │  │ метрики LMS │  │ дію зі      │  │ персональну │
 │ ловить      │  │ + історію   │  │ сценаріїв   │  │ чернетку    │
 │ тривожні    │  │ ДЗ + чат-   │  │ школи з     │  │ листа в     │
 │ сигнали     │  │ контекст    │  │ прогнозом   │  │ стилі школи │
 └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
        │                │                │                │
        └────────────────┴────────────────┴────────────────┘
                              │
                              ▼
                    ┌───────────────────────┐
                    │  Claude API           │
                    │  (Sonnet 4.6+ / Opus) │
                    └───────────────────────┘
```

### 4.1 Агент-Спостерігач
- **Тригер**: scheduled (раз на день) або event-driven (новий Slack-message → webhook).
- **Вхід**: Slack-повідомлення учня з останніх 7 днів (з трьох типів каналів: mentor_dm, group_chat, support_chat).
- **Логіка**: prompt-classifier на Claude — шукає тривожні сигнали з 7-етапної послідовності (з власної експертизи Nadin як ментора GoIT, див. [§6.3](#63-сигнали-дропауту-польова-експертиза)):
  1. ДЗ із запізненням
  2. Пропустив 1–2 уроки з викладачем
  3. Перестав ставити питання
  4. Не здав ДЗ взагалі
  5. Не заходив у LMS >7 днів
  6. Негативні повідомлення ("складно", "кину", "не встигаю")
  7. Не відповідає на ПП ментора
- **Вихід**: список (student_id, signal_type, severity 0–10) → передається оркестратору.

### 4.2 Агент-Аналітик
- **Тригер**: коли Спостерігач знайшов сигнал severity ≥ 5.
- **Вхід**: повний контекст учня — записи з `students`, `homework`, `slack_messages` за 30 днів + інформація про курс і ментора.
- **Логіка**: Claude-агент агрегує дані у структурований профіль ризику з конкретною причиною: "Учень X не здав 2 ДЗ підряд (модулі 4, 5), останні 5 повідомлень містять фрустрацію щодо швидкості курсу, не заходив у LMS 6 днів. Ймовірна причина: time pressure + technical difficulty з React Hooks."
- **Вихід**: structured JSON (risk_score, primary_drivers, supporting_evidence, urgency).

### 4.3 Агент-Стратег
- **Вхід**: профіль ризику від Аналітика.
- **Логіка**: Claude-агент обирає одну з playbook-дій школи з очікуваним успіхом:
  - Написати персональне повідомлення.
  - Запропонувати дзвінок.
  - Дати додатковий матеріал по слабкій темі.
  - Запропонувати заморозку курсу.
  - Запропонувати перевести на наступний потік.
- **Вихід**: (action_type, expected_lift_qualitative, rationale).

### 4.4 Агент-Комунікатор
- **Вхід**: action_type + student profile + школьний tone-of-voice (з конфігурації).
- **Логіка**: Claude-агент генерує чернетку повідомлення в стилі школи. Завжди — як draft, ніколи не відправляється автоматично. Менеджер натискає "Send" після перегляду.
- **Вихід**: textual draft (не markdown — рідний формат каналу: Slack/Email).

### 4.5 Чому саме така архітектура (не custom Python)
- **n8n** — visual workflow tool, низький bar to entry для команди. Дмитро + Микола як AI-engineers будують flow без heavy backend.
- **Claude через abstraction layer** — vendor-agnostic, можна свопнути на GPT/Gemini.
- **Стейт через Postgres** — простіше за окремий vector DB; на масштабі демо 20 студентів все вміщується.
- **Без кастомного orchestrator-engine** — n8n має вбудовані retry, error handling, scheduled triggers.

## 5. Структура БД (half-real mock для хакатона)

> Схема узгоджена з Nadin у Telegram-чаті 8 травня 2026. **Дані — half-real**: всі поведінкові поля (registration / homework / grades / submission timing) — з реального датасету [OULAD](https://doi.org/10.6084/m9.figshare.5081998) (Open University Learning Analytics, CC BY 4.0). Імена/email/ментори/Slack-повідомлення — згенеровані синтетично, але детерміністично прив'язані до реальних паттернів поведінки. Повний мапінг кожного поля — [data/oulad/MAPPING.md](../data/oulad/MAPPING.md).

```sql
-- students: базова інформація
students (
  id            TEXT PRIMARY KEY,         -- "stud_001"
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  course_id     TEXT REFERENCES courses(id) ON DELETE RESTRICT,
  mentor_id     TEXT REFERENCES mentors(id) ON DELETE RESTRICT,
  enrollment_date  DATE NOT NULL,
  current_module   INTEGER NOT NULL,
  status        TEXT CHECK (status IN ('active','paused','dropped','completed')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- mentors: хто веде учнів
mentors (
  id        TEXT PRIMARY KEY,             -- "mentor_05"
  name      TEXT NOT NULL,
  slack_id  TEXT NOT NULL                 -- "U045XYZ"
);

-- courses: контекст для AI
courses (
  id              TEXT PRIMARY KEY,       -- "fullstack_42"
  name            TEXT NOT NULL,
  total_modules   INTEGER NOT NULL,
  duration_weeks  INTEGER NOT NULL,
  format          TEXT CHECK (format IN ('bootcamp','self_paced','live'))
);

-- homework: хто, коли, що здав
homework (
  id            BIGSERIAL PRIMARY KEY,
  student_id    TEXT REFERENCES students(id) ON DELETE CASCADE,
  hw_id         TEXT NOT NULL,            -- "hw_12"
  module        INTEGER NOT NULL,
  title         TEXT NOT NULL,            -- "React Hooks - useState"
  topic         TEXT NOT NULL,
  deadline      DATE NOT NULL,
  submitted_at  TIMESTAMPTZ,              -- NULL якщо не здав
  status        TEXT CHECK (status IN ('missed','late','submitted','graded')),
  grade         INTEGER                    -- NULL якщо ще не оцінений
);

-- slack_messages: основне джерело для AI-Спостерігача
slack_messages (
  id                BIGSERIAL PRIMARY KEY,
  student_id        TEXT REFERENCES students(id) ON DELETE CASCADE,
  channel_type      TEXT CHECK (channel_type IN ('mentor_dm','group_chat','support_chat')),
  is_from_student   BOOLEAN NOT NULL,
  message_text      TEXT NOT NULL,
  sent_at           TIMESTAMPTZ NOT NULL,
  mentioned_mentor  BOOLEAN DEFAULT FALSE
);

-- (опціонально) login_events: активність у LMS
login_events (
  id          BIGSERIAL PRIMARY KEY,
  student_id  TEXT REFERENCES students(id) ON DELETE CASCADE,
  event_type  TEXT,                       -- 'login','lesson_view','video_watch','quiz_attempt'
  event_at    TIMESTAMPTZ NOT NULL,
  metadata    JSONB
);
```

### Обсяг даних для демо (поточний стан в БД)

| Таблиця | Кількість | Джерело |
|---|---|---|
| `mentors` | 3 | синтетично (Тетяна Шкарупа / Артем Гордієнко / Ірина Лавріненко) |
| `courses` | 1 (Algebra Foundations Spring 2026) | mapped з OULAD AAA-2013J (268 днів, 38 weeks) |
| `students` | 15 | **OULAD real**: id_student / registration_date / final_result; синтетично — name (UA-fake) / email (трансліт) / mentor_id (round-robin) |
| `homework` | 90 (15 × 6 assessments) | **OULAD real**: deadlines / submission_date / score / status; mapped з `assessments` + `studentAssessment` |
| `slack_messages` | 61 | **синтетично**, але прив'язано до реального persona-поведінки (HIGH_RISK → "кину курс"; PASS → регулярні питання; FALSE_ALARM → calm одиничні DM) |

Розбивка на 4 demo-персони (див. §6.1):
- 1 Distinction → FALSE_ALARM
- 8 Pass → PASS / SILENT_BUT_OK mix
- 3 Fail → MEDIUM_RISK
- 3 Withdrawn → HIGH_RISK

**Pipeline**: `npm run data:full` (одна команда) → `data/oulad/download.js` тягне 47 MB ZIP з figshare → `sample.js` семплює та генерує JSON → `01_oulad_sample.ts` (Knex seed) заливає в БД. Все ідемпотентно, [data/oulad/MAPPING.md](../data/oulad/MAPPING.md) описує кожне поле і його джерело.

## 6. Демо-сценарій

### 6.1 Чотири персони студентів

Створюються свідомо, щоб показати **і чутливість**, і **точність** системи (false-positive і false-negative resistance).

| Тип | Поведінка | Скільки осіб | Що має побачити AI |
|---|---|---|---|
| **HIGH RISK** ("герой-студент") | Не здав 2–3 ДЗ підряд; не заходив 5–7 днів; останні повідомлення: "не встигаю", "складно", "мабуть кину"; майже не пише ментору | 1–2 | Виявити негайно, рекомендувати дзвінок + персональну підтримку |
| **MEDIUM RISK** | Активність падає; ДЗ із запізненням; в повідомленнях втома | 3–4 | Виявити, рекомендувати soft-touch (email-нагадування, додатковий матеріал) |
| **SILENT BUT OK** | Мало пише в чаті, але стабільно здає ДЗ і регулярно заходить | 1–2 | **НЕ** позначити як ризиковий — показує, що ми розумніші за просте правило "мовчить = біда" |
| **FALSE ALARM** | Довго не писав, але недавно здав усе добре | 1 | **НЕ** позначити — показує здатність системи переглянути ризик при позитивному сигналі |

### 6.2 User Flow дашборду (8 кроків)

Узгоджено з Nadin, відображає реальний робочий день School Manager.

1. **Entry** — Manager відкриває дашборд зранку.
2. **Overview** — KPI зверху: Active students, Risk count, тренд за тиждень.
3. **Alert List** — топ 5–10 ризикових учнів, сортування high → medium, кожен рядок: ім'я + score + 1-рядок причини.
4. **Student Details** (клік на учня) — профіль + timeline (графік логінів, ДЗ, повідомлень) + AI-пояснення.
5. **AI Recommendation** — пропонована дія (5 варіантів playbook).
6. **Draft Message** — готова чернетка від AI, редагована, кнопка Send.
7. **Action** — повідомлення відправлено, видно статус (delivered / read / replied).
8. **Feedback Loop** — учень відповів → ризик переоцінюється; якщо OK — виходить з alert list.

Усе живе в одному дашборді, без переходу між системами.

### 6.3 Сигнали дропауту (польова експертиза)

7-етапна послідовність, як її описала Nadin (ментор GoIT) з власної практики. Це **головний empirical input** для feature engineering AI-Спостерігача. Повний Q&A інтерв'ю — у [docs/research/goit-interview.md](research/goit-interview.md).

| # | Сигнал | Час до дропауту |
|---|---|---|
| 1 | ДЗ із запізненням | ~3–4 тижні |
| 2 | Пропустив 1–2 уроки з викладачем | ~3 тижні |
| 3 | Перестав ставити питання в чаті (раніше питав) | ~2 тижні |
| 4 | Не здав ДЗ взагалі | ~1.5 тижні |
| 5 | Не заходив у LMS >1 тижня | ~1 тиждень |
| 6 | Негативні повідомлення: "не встигаю", "складно", "мабуть кину" | ~5–7 днів |
| 7 | Не відповідає на ПП ментора | <5 днів — "морально пішов" |

**Червона зона** (Nadin): 3+ пропущених ДЗ, 1–2 тижні мовчання в Slack, 2+ модулі відставання від когорти. Після 5–6 етапу повернути дуже складно.

Це підтверджується академічною літературою: Yukselturk & Inan 2008 ([✓](#proof-eric-distance-ed)) називають **Top-3 фактори дропауту**: time to study, personal problems, affordability — усі троє корелюють із сигналами 1–4.

## 7. Технологічний стек

| Шар | Інструмент | Чому |
|---|---|---|
| Backend API | Node.js + TypeScript (Express + Knex) | Скелет уже в репо |
| БД | PostgreSQL | Half-real mock з OULAD ([MAPPING.md](../data/oulad/MAPPING.md)) |
| **AI Orchestration** | **n8n** | Visual workflow для агентів; команда (Дмитро + Микола) комфортна з low-code AI-flow |
| LLM | Claude (Sonnet 4.6+ або Opus 4.5+) через API | Особиста підписка Arsenii ($100/міс), вистачить лімітів |
| Frontend | Next.js + Tailwind + shadcn + Tremor + Recharts | Швидко, сучасно, OSS |
| Auth | Clerk (free tier 50k MRUs — [✓](#proof-clerk-pricing)) | Не писати з нуля |
| Hosting | VPS Arsenii (для демо); production пізніше — Render / Railway | Дешево, контрольовано |
| Email/Slack delivery (post-hackathon) | Resend / Slack Web API | Не пріоритет на демо |

### Конвенції з кореневого `CLAUDE.md` (обов'язково)
- TypeScript strict, CommonJS (не ESM).
- Snake_case у БД, camelCase у JS — мапінг явний у роуті.
- `created_at` / `updated_at` — `TIMESTAMPTZ`, дефолт `now()`.
- Гроші — `NUMERIC`, ніколи `FLOAT`.
- Foreign keys ЗАВЖДИ з явним `ON DELETE`.
- Без `CREATE TYPE ... AS ENUM` — використовувати CHECK або lookup-таблицю.
- Один Knex інстанс (`src/db.ts`).
- SQL — через query builder або `db.raw('... ?', [val])`. Без конкатенації.

## 8. Команда і ролі

Узгоджено на zoom-мітингу 8 травня 2026.

| Людина | Роль | Зона відповідальності |
|---|---|---|
| **Arsenii** | Frontend + Backend Lead + AI Integration | Дашборд, оркестрація агентів, API, інтеграція AI у продукт. Хост на власному VPS. |
| **Дмитро + Микола** | AI Agents Engineer + n8n Orchestration | Тригери, воркфлоу, промпти, логіка кожного агента, інтеграція з Claude API |
| **Олексій + Маргарита** | Data Analytics | Sampling/мапінг OULAD на нашу схему, валідація 4 персон, метрики дашборду (поточний sample вже залитий — наступне: розширення scenarios + uplift baseline) |
| **Гюльзар** | Product Designer (UX) | Дизайн дашборду, екранів профілю, demo-flow візуально |
| **Еріка** | AI Content + Presentation | Tone-of-voice для агента-Комунікатора, шаблони повідомлень, презентація, відео-демо |
| **Nadin** | Tech Lead / BA | Координація, ТЗ, польова експертиза EdTech (досвід ментора GoIT), підхват у Arsenii |

## 9. Архітектура — Post-Hackathon Roadmap

> Усе нижче — **НЕ в хакатоні**. Це бачення, як еволюціонує продукт після demo. У презентації показуємо як план розвитку.

### 9.1 ML-шар як попередній фільтр

Гібридна архітектура: класична ML-модель швидко скорить **усіх** учнів, multi-agent глибоко аналізує **тільки топ-ризикових** (наприклад, top-20% за score). Це дає:
- **Економія 75–85% на витратах AI** (агенти бачать тільки 20% бази).
- **Масштабованість до 10k+ учнів** без exploding cost.
- **Маржа 70–80%** на рівні школи з 1000+ учнів.
- **"Класичний" tier** для клієнтів, які бояться LLM-обробки (для шкіл з compliance-обмеженнями).

Стек ML-шару:
- **XGBoost / LightGBM** ([↗](#glossary-xgboost)) — baseline на табличних фічах.
- **SHAP feature attribution** ([↗](#glossary-shap)) — пояснення скорів, передається агенту-Аналітику як контекст.
- **Survival analysis (Cox / DeepSurv)** ([↗](#glossary-survival)) — для прогнозу "коли" дропне, не лише "чи".
- **Uplift modeling** ([↗](#glossary-uplift)) для action layer — щоб цілитися у Persuadables, не у Sleeping Dogs (див. [§11.3](#113-чому-uplift-modeling--churn-prediction)).

### 9.2 Реальні інтеграції

- **LMS webhooks**: Thinkific, Teachable, Kajabi, Moodle, custom — кожна нова = 1–3 тижні роботи.
- **Slack / Discord APIs** — для агента-Спостерігача в реальних чатах.
- **Stripe / Recurly** — для signal "downgrade / failed payment".
- **Mailchimp / Resend** — для відправки агентом-Комунікатором.

### 9.3 A/B testing engine
RCT-розбивка з самого початку action layer: треба довести **uplift від інтервенцій**, не просто accuracy churn-моделі. Це і буде real product moat (див. [§11](#11-емпіричний-фундамент)).

### 9.4 Modes продукту

- **Окремий продукт** (SaaS, $300–500/міс підписка). Це попадає в "underserved middle" між безкоштовною Excel-таблицею ментора і enterprise-CSP типу Gainsight, який починається від $1000/міс і вище ([✓ verified](#proof-gainsight-pricing) — pricing непублічне; цифри з G2/Capterra). Default для хакатона.
- **Модуль / API** для інтеграції в існуючі LMS-платформи (B2B2C через Thinkific/Teachable). Архітектурно одразу будуємо так, щоб обидва формати були можливі.
- **Партнерство з платформами** під їхнім брендом (white-label).
- **Пілот за сегментом** (тільки бізнес-курси, тільки bootcamps).

## 10. Бюджет

### 10.1 Хакатон (10 днів)

| Стаття | Сума | Хто покриває |
|---|---|---|
| Claude API на демо | **~$10** | особистий Arsenii |
| Claude підписка | $100/міс — вже є | особистий Arsenii |
| VPS (Ubuntu 24.04, 96 GB / 5.8 GB RAM) | вже є | особистий Arsenii |
| Домен `my-own-testing.space` | вже є | особистий Arsenii |
| HTTPS-cert (Let's Encrypt / ZeroSSL) | $0 — auto-issuance через Caddy | — |
| **Разом грошового видатку команди** | **~$10** (Claude API на час хакатона) | Arsenii |

### 10.2 Софт (post-hackathon)

- Чарт-бібліотеки (Recharts, Tremor, D3, Plotly OSS, ECharts): **$0**.
- ML-стек (sklearn, XGBoost, SHAP, Lifelines, CausalML): **$0**.
- Postgres, Redis (OSS), pgvector: **$0** (платиш за hosting).
- n8n self-host: **$0** (Docker compose, OSS).

### 10.3 Hosting (post-hackathon, оцінка)

- MVP з 3–5 пілотами (2–4 міс): **$200–500/міс**.
- 10–30 платних клієнтів (5–9 міс): **$1000–3000/міс**.
- Зрілий MVP (10–12 міс): **$5000–15000/міс** (з SOC 2 і юристом).

### 10.4 LLM API (post-hackathon, основна стаття витрат)

- Claude Sonnet **$3/M input, $15/M output** ([✓ verified](#proof-claude-pricing)). Реалістично на повноцінному multi-agent pipeline: **~$200–400/міс на середню школу 500 учнів**.
- Гібрид з ML-шаром (агенти тільки на top-20%) — **~$40–80/міс на ту ж школу**.
- На старті — first-party API. Self-hosted моделі (Llama / Qwen / Mistral через [vLLM](#glossary-vllm)) дешевші тільки при постійному навантаженні.

## 11. Емпіричний фундамент

Цифри, на які спирається продуктова логіка. Усі — з академічних джерел через `tools/proof-researcher` (proofs у `docs/proofs/empirical/`). Wikipedia-джерела доповнено первинними академічними публікаціями.

### 11.1 Дропаут і completion rate (primary academic sources)

- **Median MOOC completion rate: 12.6%** (range 0.7%–52.1%) на 221 курсах. Перші 1–2 тижні — критичні: після них активність stabilises (різниця <3% у наступні тижні). — Jordan 2015 IRRODL [✓ verified](#proof-jordan-2015-irrodl).
- **edX 6.002x (перший edX курс): <5% completion** з 154,763 enrolled. — Breslow et al. 2013 [✓ verified](#proof-breslow-edx-2013).
- **Distance education dropout: 30–50%** (літературний consensus у US; Європа 20–30%; Азія до 50%). Top-3 фактори дропауту з survey: time to study, personal problems, affordability. — Yukselturk & Inan 2008 [✓ verified](#proof-eric-distance-ed).
- **Online dropout vs offline: на 10–20% вищий, у деяких студіях — у 6–7 разів**. Концепт **Course Walls** — модулі, де студенти масово застрягають. — Christensen & Spackman 2017 [✓ verified](#proof-eric-online-vs-offline).
- **Harvard/MIT MOOC, 2012: 22% completion** average — Ho, Reich et al. HarvardX/MITx report через Wikipedia [✓ verified](#proof-mooc-wiki).
- **Висновки для нашого продукту**:
  - Feature engineering ML-моделі (post-hackathon) має давати **перші 2 тижні × 3–5 більше ваги**.
  - **Course Walls** як окрема product-фіча: знаходити модулі, де когорта застрягає, повідомляти школу. Реалізовується агентом-Аналітиком.

### 11.2 Точність ML-моделей дропауту

- **AUC 87.33% production / 90.20% post-hoc** на 40 HarvardX MOOCs за 8 тижнів. Розрив 2.87 п.п. AUC між тестовим стендом і production-режимом. 5-layer NN значно кращий за logistic regression. — Whitehill et al. 2017 [✓ verified](#proof-whitehill-mooc-dropout).
- **Стандартні метрики churn-моделі**: AUC + Top Decile Lift; подвійна мета — predictive performance + interpretability. — De Caigny et al. 2018 [✓ verified](#proof-customer-attrition-wiki).
- **Висновок**: реалістичний таргет 85–90% AUC за достатнього обсягу даних; перші клієнти отримають нижчий performance до накопичення training data — мітигується heuristic baseline на старті.

### 11.3 Чому uplift-modeling ≠ churn-prediction

- **4 сегменти юзерів** ([↗](#glossary-uplift)): Persuadables / Sure Things / Lost Causes / Sleeping Dogs. Тільки **Persuadables** дають incremental ROI. — Lo 2002, Radcliffe 2007, через Wikipedia [✓ verified](#proof-uplift-modeling-wiki).
- **Sleeping Dogs ефект**: retention-кампанії документовано **підвищують** churn серед "сплячих" клієнтів у telco і financial services.
- **Слідство**: traditional churn-prediction цілить у Sure Things (висока ймовірність churn ≠ висока ймовірність response). Uplift-модель — у Persuadables. Це різні objective functions.
- **Висновок**: для post-hackathon action layer треба **uplift, не пропенсіті**.

### 11.4 Контекст ринку

- **Coursera**: 168M юзерів (2024), $694.7M revenue, **net loss $79M** — навіть лідер не вирішив unit economics. — [✓ verified](#proof-coursera-wiki).
- **edX**: 83M юзерів (2023); материнська 2U подала Chapter 11 у липні 2024. — [✓ verified](#proof-edx-wiki).
- **US online learning**: 7.5M онлайн-студентів (2024); 53%+ постграду беруть хоча б один онлайн-курс. — [✓ verified](#proof-k12-online-wiki).
- **Coding bootcamps**: 8–36 тижнів (середнє 12.9), ціна $0–$21k (середнє $11,874), deferred tuition 18–22.5% зарплати. — [✓ verified](#proof-coding-bootcamp-wiki).
- **Distance learning** дропаут drivers (research consensus): self-regulation, time management, language, technology — [✓ verified](#proof-distance-education-wiki).
- **Висновок**: retention/conversion болить навіть на масштабі 80M+ юзерів — проблема не вирішена, ринок існує.

## 12. Ризикові зони

| Зона | Що показує література / польова експертиза | Як ми мітигуємо в хакатоні |
|---|---|---|
| Multi-agent ловить глюки і бага | n8n + Claude може давати unstable output | Жорсткі structured outputs (JSON schema), evals на 4 demo-персонах перед finalізацією |
| LLM hallucinations у Comunікатор-агенті | Будь-яка LLM може вигадати факти про учня | Завжди як **draft**; menедж натискає Send. Контекст агента — тільки реальні поля з БД, не свободна інтерпретація |
| Сильна презентація > слабкий код | Команда має 10 днів і денну роботу | Nadin: фокус на стабільне demo + сильна презентація, не на технічну глибину. Складні фічі (uplift, ML) — у roadmap, не в demo |
| Дані half-real → демо неправдоподібне | Журі може помітити "штучність" сценаріїв | Поведінкова частина (homework deadlines, submission dates, grades, registration) — реальна з OULAD (32k студентів Open University); тільки чати + імена синтетичні. 4 типи персон (включно з false-positive resistance: SILENT BUT OK + FALSE ALARM) — з реальних `final_result` категорій. Повний transparent-mapping у [MAPPING.md](../data/oulad/MAPPING.md) для аудиту журі. |
| Якість ML на малих/брудних даних (post-hackathon) | Production AUC ~3 п.п. нижчий за post-hoc | На хакатоні немає ML — це не ризик. Post-hackathon: heuristic baseline → ML тільки після ≥5–10 клієнтів × ≥6 міс даних |
| Compliance (GDPR / FERPA / COPPA) | Юридична частина не вирішується інженерно | На хакатоні — OULAD (повністю анонімізований ARX-tool, CC BY 4.0, peer-reviewed Nature) + синтетичні чати. Нульовий compliance-ризик, коректна атрибуція в [MAPPING.md](../data/oulad/MAPPING.md). Юрист на ретейнер з 6-го місяця для real-LMS інтеграцій. |
| SOC 2 Type II (post-hackathon, enterprise) | 6–12 міс процесу | Старт SOC 2 — 9–10 місяць roadmap |

**Найризикованіше місце MVP**: довести uplift від інтервенцій RCT-тестом, а не просто accuracy моделі. На хакатоні цього не показуємо — у roadmap.

## 13. Roadmap

| Етап | Дати | Вихід |
|---|---|---|
| **Хакатон demo** | 9–18 травня 2026 | Multi-agent система + dashboard + 4 демо-персони + презентація + відео |
| **Перші пілотні школи** | травень–червень 2026 | 1–2 школи (через знайомства Nadin у GoIT) тестують на реальних даних |
| **ML-шар** | липень–вересень 2026 | XGBoost + SHAP як попередній фільтр перед агентами; гібридна архітектура |
| **A/B testing engine + uplift** | жовтень–грудень 2026 | Доказ incremental retention на A/B тесті з 1 школою |
| **Scale + диференціація** | 2027 Q1–Q2 | Marketplace listings (Thinkific/Teachable), self-serve onboarding, $20–50k MRR |
| **Enterprise readiness** | 2027 Q3–Q4 | SSO, audit logs, multi-tenant guarantees, self-hosted LLM, перші enterprise-угоди ($1000+/міс) |

## 14. Що НЕ робити (антипатерни)

- Не додавати ML на хакатоні — навіть як baseline. Це з'їсть час і не дасть value на демо. ML — у roadmap.
- Не вгадувати причини відтоку через LLM без даних. Агент-Аналітик має посилатися на конкретні факти з БД, не на здогадки.
- Не починати з survival analysis або uplift modeling — це post-hackathon.
- Не масштабувати інтеграції з LMS — на хакатоні дані half-real з OULAD; реальна real-time інтеграція з GoIT/Hillel/etc — після пілота.
- Не писати своє BI з нуля — Tremor + Recharts вистачить.
- Не додавати auth/rate-limiting/observability стек до бекенду без явного прохання — система навмисно мала.
- Не плодити сервіси: Postgres-агрегації, не ClickHouse; pgvector у Postgres, не Pinecone — поки обсяги дозволяють.
- Не відправляти повідомлення учням автоматично без human-in-the-loop. Завжди draft → Send manual.

## 15. Перевірені цифри (proofs)

Усі цифри перевірені через `tools/proof-researcher` (Patchright stealth — Playwright з anti-detection patches; bypass Akamai/Cloudflare). Кожна папка містить `screenshot.png` + `text.md` (зі вставленим скріншотом) + `notes.md` (з verbatim-цитатою). Стан на 2026-05-09.

### 15.1 Емпіричні цифри (індустрія, академічні дослідження)

#### Дропаут і completion rate за типом курсу

| Тип курсу | Цифра | Primary source | Proof |
|---|---|---|---|
| <a id="proof-jordan-2015-irrodl"></a>MOOC (median, 221 курсів) | **12.6%** completion (range 0.7%–52.1%); перші 1–2 тижні критичні | **Jordan 2015 IRRODL** (peer-reviewed) | [jordan-2015-irrodl](proofs/empirical/jordan-2015-irrodl/notes.md) |
| <a id="proof-breslow-edx-2013"></a>edX 6.002x (перший edX курс) | **<5%** completion з 154,763 enrolled | **Breslow et al. 2013** (Research & Practice in Assessment) | [breslow-edx-2013](proofs/empirical/breslow-edx-2013/notes.md) |
| <a id="proof-eric-distance-ed"></a>Distance education (US консенсус) | Dropout **30–50%** (Європа 20–30%; Азія до 50%); top-3 драйвери: time, personal, affordability | **Yukselturk & Inan 2008** (ERIC ED494345) | [eric-distance-ed](proofs/empirical/eric-distance-ed/notes.md) |
| <a id="proof-eric-online-vs-offline"></a>Online dropout vs offline | На **10–20% вищий**; у деяких студіях у **6–7 разів**; концепт Course Walls | **Christensen & Spackman 2017** (Journal of Educators Online) | [eric-online-vs-offline](proofs/empirical/eric-online-vs-offline/notes.md) |
| <a id="proof-katy-jordan-mooc"></a>MOOC (Katy Jordan website, історична) | 15% (max ~40%), типовий enrollment 25,000 | Katy Jordan dataset (через web archive) — cross-check | [katy-jordan-mooc](proofs/empirical/katy-jordan-mooc/notes.md) |
| <a id="proof-mooc-wiki"></a>Harvard/MIT MOOC, 2012 | 22% completion average; Tasmania "Understanding Dementia" 39% | Wikipedia: MOOC (cited Ho, Reich et al.) | [mooc-wiki](proofs/empirical/mooc-wiki/notes.md) |
| <a id="proof-coding-bootcamp-wiki"></a>Coding bootcamps | Тривалість 8–36 тижнів (середня 12.9); ціна $0–$21k (середня $11,874); deferred tuition 18–22.5% зарплати | Wikipedia: Coding bootcamp + Course Report 2017 | [coding-bootcamp-wiki](proofs/empirical/coding-bootcamp-wiki/notes.md) |
| <a id="proof-coursereport-bootcamps"></a>Coding bootcamps 2026 ринок | Топ-26 bootcamps (Le Wagon, Springboard, TripleTen ...), CIRR-стандарт outcomes; AI-tools уже інтегровані | Course Report (2026 listing, верифіковано) | [coursereport-bootcamps](proofs/empirical/coursereport-bootcamps/notes.md) |
| <a id="proof-distance-education-wiki"></a>Distance learning драйвери | Self-regulation, time management, language, technology | Wikipedia: Distance education (cross-check) | [distance-education-wiki](proofs/empirical/distance-education-wiki/notes.md) |
| <a id="proof-hillel-courses"></a>Hillel (UA-школа, ICP) | Multi-track школа (програмування, QA, PM/BA, дизайн, маркетинг, англ., діти 12-17); 3-тижневе 100% refund-вікно; LiqPay/plata by mono | ithillel.ua/courses (верифіковано) | [hillel-courses](proofs/empirical/hillel-courses/notes.md) |

#### Точність ML-моделей дропауту і ефективність AI tutoring

| Метрика | Цифра | Primary source | Proof |
|---|---|---|---|
| <a id="proof-whitehill-mooc-dropout"></a>AUC churn-моделі (production) | **87.33% AUC**; post-hoc 90.20% AUC; різниця 2.87 п.п. | **Whitehill et al. 2017** (arxiv 1702.06404), 40 HarvardX MOOCs × 8 тижнів | [whitehill-mooc-dropout](proofs/empirical/whitehill-mooc-dropout/notes.md) |
| <a id="proof-bloom-2-sigma"></a>Bloom 2-sigma problem | 1-on-1 tutoring → effect size **2.0σ** (98-й перцентиль); 90% tutored students перевершують top-20% control | **Bloom 1984** (Educational Researcher, peer-reviewed) | [bloom-2-sigma](proofs/empirical/bloom-2-sigma/notes.md) |
| <a id="proof-intelligent-tutoring-wiki"></a>AI tutoring meta-analysis (modern ITS) | Median ES **0.66** (50→75 перцентиль), перемога у 46/50 порівнянь (92%); ITS на локальних тестах ES 0.73 vs 0.13 standardized | **Kulik & Fletcher 2015** meta-analysis 50 досліджень; **VanLehn 2011** (ITS = expert human tutors) | [intelligent-tutoring-wiki](proofs/empirical/intelligent-tutoring-wiki/notes.md) |

#### Метрики й моделювання retention

| Концепт | Визначення | Source | Proof |
|---|---|---|---|
| <a id="proof-customer-attrition-wiki"></a>Стандартні метрики churn-моделі | Area Under ROC + Top Decile Lift; подвійна ціль — performance + interpretability | De Caigny, Coussement, De Bock 2018, EJOR (через Wikipedia) | [customer-attrition-wiki](proofs/empirical/customer-attrition-wiki/notes.md) |
| <a id="proof-uplift-modeling-wiki"></a>Uplift segments (4 групи) | Persuadables / Sure Things / Lost Causes / Sleeping Dogs — лише Persuadables дають incremental ROI | Lo 2002; Radcliffe 2007; через Wikipedia: Uplift Modelling | [uplift-modeling-wiki](proofs/empirical/uplift-modeling-wiki/notes.md) |
| <a id="proof-churn-rate-wiki"></a>Формула churn rate | `churned / customers_at_start × 100` за період | Wikipedia: Churn rate | [churn-rate-wiki](proofs/empirical/churn-rate-wiki/notes.md) |

#### Ринок онлайн-освіти

| Показник | Цифра | Source | Proof |
|---|---|---|---|
| <a id="proof-coursera-wiki"></a>Coursera | 168M юзерів (2024), $694.7M revenue, **net loss $79M** | Wikipedia: Coursera | [coursera-wiki](proofs/empirical/coursera-wiki/notes.md) |
| <a id="proof-edx-wiki"></a>edX | 83M юзерів (2023); 2U Chapter 11 у липні 2024 | Wikipedia: edX | [edx-wiki](proofs/empirical/edx-wiki/notes.md) |
| <a id="proof-k12-online-wiki"></a>Online learning США | **7.5M онлайн-студентів** (2024); 53%+ постграду беруть онлайн-курси | Wikipedia: Cyber school | [k12-online-wiki](proofs/empirical/k12-online-wiki/notes.md) |

### 15.2 Pricing цифри (SaaS-вендори)

| Сервіс | Перевірена цифра (2026-05-09) | Verdict | Proof |
|---|---|---|---|
| <a id="proof-claude-pricing"></a>Claude API (Sonnet) | $3/M in, $15/M out | ✅ confirmed | [claude-pricing](proofs/claude-pricing/notes.md) |
| Claude API (Opus) | $5/$25 (Opus 4.5+) або $15/$75 (4/4.1) | ✅ confirmed | [claude-pricing](proofs/claude-pricing/notes.md) |
| Claude API (Haiku) | $1/$5 (Haiku 4.5) або $0.80/$4 (Haiku 3.5) | ✅ confirmed | [claude-pricing](proofs/claude-pricing/notes.md) |
| <a id="proof-pinecone-pricing"></a>Pinecone | Starter free; Builder $20/міс; Standard $50/міс мін.; Enterprise $500/міс мін. | ✅ confirmed | [pinecone-pricing](proofs/pinecone-pricing/notes.md) |
| <a id="proof-auth0-pricing"></a>Auth0 | Free **25,000 MAU**; платні плани через MAU-слайдер | ✅ confirmed | [auth0-pricing](proofs/auth0-pricing/notes.md) |
| <a id="proof-clerk-pricing"></a>Clerk | Hobby free **50,000 MRUs**; Pro $25/міс ($20 yearly); $0.02/MRU (50k–100k); Business $300/міс | ✅ confirmed | [clerk-pricing](proofs/clerk-pricing/notes.md) |
| <a id="proof-sentry-pricing"></a>Sentry | Developer free; Team $26/міс; Business $80/міс | ✅ confirmed | [sentry-pricing](proofs/sentry-pricing/notes.md) |
| <a id="proof-metabase-pricing"></a>Metabase | OSS AGPL self-host $0; Cloud Starter $100/міс + $6/user; Pro $575/міс + $12/user; Enterprise $20k/рік | ✅ confirmed | [metabase-pricing](proofs/metabase-pricing/notes.md) |
| <a id="proof-tableau-pricing"></a>Tableau | Standard $15/user/міс; Enterprise $35/user/міс (billed annually) | ✅ confirmed | [tableau-pricing](proofs/tableau-pricing/notes.md) |
| <a id="proof-powerbi-pricing"></a>Power BI | Pro $14/user/міс; Premium Per User $24/user/міс (paid yearly) | ✅ confirmed | [powerbi-pricing](proofs/powerbi-pricing/notes.md) |
| <a id="proof-mongodb-atlas-pricing"></a>MongoDB Atlas | Free (M0) $0 forever; Flex $0.011/год до $30/міс; Dedicated від $56.94/міс | ✅ confirmed | [mongodb-atlas-pricing](proofs/mongodb-atlas-pricing/notes.md) |
| <a id="proof-ag-grid-pricing"></a>AG Grid | Community free (MIT); Enterprise $999/dev; Bundle $1,498/dev | ✅ confirmed | [ag-grid-pricing](proofs/ag-grid-pricing/notes.md) |
| <a id="proof-highcharts-pricing"></a>Highcharts | Non-commercial CC BY-NC безкоштовно; Annual від $185/seat; Perpetual від $366/seat | ✅ confirmed | [highcharts-pricing](proofs/highcharts-pricing/notes.md) |
| <a id="proof-drata-pricing"></a>Drata | Pricing непублічний (Cloudflare-захищений "Contact sales") | ✅ confirmed (як non-public) | [drata-pricing](proofs/drata-pricing/notes.md) |
| <a id="proof-gainsight-pricing"></a>Gainsight (analog для нашого SaaS pricing) | Тільки 2 tiers (Essentials, Enterprise), обидва "Contact Sales"; ринкові оцінки з G2: Essentials ~$1k/міс, Enterprise $20–60k/рік | ✅ confirmed (як non-public) | [gainsight-pricing](proofs/empirical/gainsight-pricing/notes.md) |

## 16. Як перевірити нову цифру

Запусти Playwright-скріншотер через slash-агента:

```
Use the proof-researcher agent to verify "<твоя_цифра>" from <url>.
```

Або напряму:

```bash
cd tools/proof-researcher
node screenshot.js \
  --url "<URL>" \
  --out "../../docs/proofs/<slug>/screenshot.png" \
  --text-out "../../docs/proofs/<slug>/text.md" \
  --full
```

Деталі формату — у [tools/proof-researcher/README.md](../tools/proof-researcher/README.md) і агенті `.claude/agents/proof-researcher.md`.

## 17. Глосарій

### Бізнес-метрики

- <a id="glossary-churn"></a>**Churn** — відтік учнів (не продовжили підписку, не закінчили курс).
- <a id="glossary-completion-rate"></a>**Completion rate** — % учнів, які завершили курс / отримали сертифікат від загальної кількості enrolled. Зворотна до dropout rate.
- <a id="glossary-dropout"></a>**Dropout / Drop-off** — % учнів, які покинули курс до завершення.
- <a id="glossary-retention"></a>**Retention** — утримання учнів. Зворотна метрика churn.
- <a id="glossary-mau"></a>**MAU / DAU / WAU** — Monthly / Daily / Weekly Active Users.
- <a id="glossary-mrr"></a>**MRR / ARR** — Monthly / Annual Recurring Revenue — повторюваний дохід з підписок.
- <a id="glossary-clv"></a>**CLV (Customer Lifetime Value)** — сумарний прибуток від клієнта.
- <a id="glossary-roi"></a>**ROI (Return on Investment)** — `(profit − cost) / cost × 100%`.
- <a id="glossary-kpi"></a>**KPI (Key Performance Indicator)** — головний показник ефективності.
- <a id="glossary-icp"></a>**ICP (Ideal Customer Profile)** — портрет ідеального клієнта.

### ML / AI / Data Science

- <a id="glossary-ml"></a>**ML (Machine Learning)** — алгоритми, що знаходять патерни у даних.
- <a id="glossary-llm"></a>**LLM (Large Language Model)** — Claude, GPT, Gemini, Llama. Передбачає наступне слово на основі контексту.
- <a id="glossary-multi-agent"></a>**Multi-agent system** — архітектура з кількох спеціалізованих AI-агентів, що співпрацюють. У нас: Спостерігач + Аналітик + Стратег + Комунікатор.
- <a id="glossary-n8n"></a>**n8n** — open-source workflow automation tool (low-code), що ми використовуємо для оркестрації агентів. Аналог Zapier/Make, але self-hosted і вільніший.
- <a id="glossary-orchestrator"></a>**Orchestrator / Planner agent** — головний агент, що приймає вхідні події, розподіляє між підлеглими агентами, агрегує результат.
- <a id="glossary-nlp"></a>**NLP (Natural Language Processing)** — обробка природної мови.
- <a id="glossary-rag"></a>**RAG (Retrieval-Augmented Generation)** — спершу шукаємо контекст у БД, потім додаємо у промпт LLM.
- <a id="glossary-embeddings"></a>**Embeddings** — числові вектори, що представляють смисл тексту.
- <a id="glossary-vector-db"></a>**Vector DB / pgvector** — БД для embeddings + пошук найближчих сусідів.
- <a id="glossary-tokens"></a>**Tokens / MTok** — одиниці тексту, якими LLM його "бачить" (~0.75 слова кожен). MTok = 1 мільйон.
- <a id="glossary-prompt-caching"></a>**Prompt caching** — повторне використання вже опрацьованої частини контексту. Знижує вартість input tokens у 5–10 разів.
- <a id="glossary-structured-output"></a>**Structured outputs** — форсування LLM повертати JSON за схемою.
- <a id="glossary-hallucination"></a>**Галюцинація** — впевнено сформульована хибна відповідь LLM.
- <a id="glossary-eval"></a>**Eval / LLM-as-judge** — автоматична оцінка якості відповідей LLM.
- <a id="glossary-feature-attribution"></a>**Feature attribution** — який вклад кожна фіча зробила у конкретне передбачення.
- <a id="glossary-shap"></a>**SHAP (SHapley Additive exPlanations)** — стандартний метод feature attribution.
- <a id="glossary-xgboost"></a>**XGBoost / LightGBM / CatBoost** — gradient boosting на деревах, baseline для табличного ML.
- <a id="glossary-survival"></a>**Survival analysis (Kaplan-Meier, Cox)** — статистичні моделі для "коли подія настане".
- <a id="glossary-uplift"></a>**Uplift modeling** — моделює, як інтервенція X змінить поведінку юзера Y. Розрізняє Persuadables, Sure Things, Lost Causes, Sleeping Dogs.
- <a id="glossary-causal-inference"></a>**Causal inference** — методи виявлення причинно-наслідкового зв'язку.
- <a id="glossary-auc"></a>**AUC (Area Under ROC Curve)** — метрика бінарного класифікатора. 0.5 = випадковий, 1.0 = ідеальний.
- <a id="glossary-roc"></a>**ROC** — крива trade-off між true positive і false positive rate.
- <a id="glossary-f1"></a>**F1 score** — гармонійне середнє precision та recall.
- <a id="glossary-top-decile-lift"></a>**Top Decile Lift** — наскільки топ-10% за score дають реальних churners порівняно з base rate.
- <a id="glossary-imbalanced"></a>**Imbalanced classes** — один клас значно рідший за інший.
- <a id="glossary-cold-start"></a>**Cold start** — модель не може давати точні передбачення для нового клієнта без історичних даних.
- <a id="glossary-transfer-learning"></a>**Transfer learning** — тренування моделі на одних даних, застосування на нових.
- <a id="glossary-heuristic"></a>**Heuristic baseline** — система правил замість ML.
- <a id="glossary-rct"></a>**RCT (Randomized Controlled Trial)** — рандомізований експеримент з контрольною і treatment-групою.
- <a id="glossary-ab-test"></a>**A/B test** — практичний RCT у продакшні.

### Інфраструктура

- <a id="glossary-api"></a>**API (Application Programming Interface)** — інтерфейс для програмного спілкування.
- <a id="glossary-webhook"></a>**Webhook** — HTTP-запит, який зовнішня система надсилає нам при події.
- <a id="glossary-event-store"></a>**Event store** — БД-таблиця для історії подій.
- <a id="glossary-idempotency"></a>**Idempotency** — повторне виконання дає той самий результат.
- <a id="glossary-dlq"></a>**DLQ (Dead Letter Queue)** — черга для повідомлень, які не вдалось обробити.
- <a id="glossary-multitenant"></a>**Multi-tenant** — одна інстанція обслуговує багато клієнтів, кожен бачить тільки свої дані.
- <a id="glossary-rls"></a>**Row-Level Security (RLS)** — Postgres-фільтрація рядків залежно від поточного юзера.
- <a id="glossary-cicd"></a>**CI/CD** — автоматичні тести + деплой при кожному коміті.
- <a id="glossary-self-hosted"></a>**Self-hosted** — софт на власній інфраструктурі.
- <a id="glossary-vllm"></a>**vLLM** — open-source inference engine для self-hosted LLM.

### EdTech

- <a id="glossary-lms"></a>**LMS (Learning Management System)** — Thinkific, Teachable, Kajabi, Moodle, GoIT custom platform.
- <a id="glossary-mooc"></a>**MOOC (Massive Open Online Course)** — масовий відкритий онлайн-курс.
- <a id="glossary-scorm"></a>**SCORM / xAPI** — стандарти LMS-івентів.
- <a id="glossary-xapi"></a>**xAPI (Experience API)** — формат `Actor-Verb-Object`.

### Бізнес-сегментація

- <a id="glossary-saas"></a>**SaaS (Software as a Service)** — софт через підписку.
- <a id="glossary-b2b"></a>**B2B / B2C** — Business-to-Business / Business-to-Consumer.
- <a id="glossary-smb"></a>**SMB / Enterprise** — Small/Medium Business vs Enterprise.

### Compliance

- <a id="glossary-gdpr"></a>**GDPR** — закон ЄС про захист персональних даних.
- <a id="glossary-ferpa"></a>**FERPA** — закон США про захист освітніх записів учнів.
- <a id="glossary-coppa"></a>**COPPA** — закон США про захист даних дітей до 13 років.
- <a id="glossary-soc2"></a>**SOC 2 Type II** — аудит безпеки організації.
- <a id="glossary-dpa"></a>**DPA (Data Processing Agreement)** — обов'язковий договір під GDPR.

---

**Дата створення документа**: 2026-05-09
**Останнє оновлення**: 2026-05-09 (повне перебудування під узгодження команди в Telegram-чаті 8–9 травня 2026)
**Команда**: Arsenii (FE+BE+AI), Дмитро + Микола (AI agents + n8n), Олексій + Маргарита (data), Гюльзар (UX), Еріка (content+presentation), Nadin (tech lead + BA)
**Дедлайн хакатона**: 18 травня 2026
