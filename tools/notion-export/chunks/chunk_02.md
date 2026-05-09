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
- **Логіка**: prompt-classifier на Claude — шукає тривожні сигнали з 7-етапної послідовності (з власної експертизи Nadin як ментора GoIT, див. **§6.3**):
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

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Таблиця</td>
		<td>Кількість</td>
		<td>Джерело</td>
	</tr>
	<tr>
		<td>`mentors`</td>
		<td>3</td>
		<td>синтетично (Тетяна Шкарупа / Артем Гордієнко / Ірина Лавріненко)</td>
	</tr>
	<tr>
		<td>`courses`</td>
		<td>1 (Algebra Foundations Spring 2026)</td>
		<td>mapped з OULAD AAA-2013J (268 днів, 38 weeks)</td>
	</tr>
	<tr>
		<td>`students`</td>
		<td>15</td>
		<td>**OULAD real**: id_student / registration_date / final_result; синтетично — name (UA-fake) / email (трансліт) / mentor_id (round-robin)</td>
	</tr>
	<tr>
		<td>`homework`</td>
		<td>90 (15 × 6 assessments)</td>
		<td>**OULAD real**: deadlines / submission_date / score / status; mapped з `assessments` + `studentAssessment`</td>
	</tr>
	<tr>
		<td>`slack_messages`</td>
		<td>61</td>
		<td>**синтетично**, але прив'язано до реального persona-поведінки (HIGH_RISK → "кину курс"; PASS → регулярні питання; FALSE_ALARM → calm одиничні DM)</td>
	</tr>
</table>

Розбивка на 4 demo-персони (див. §6.1):
- 1 Distinction → FALSE_ALARM
- 8 Pass → PASS / SILENT_BUT_OK mix
- 3 Fail → MEDIUM_RISK
- 3 Withdrawn → HIGH_RISK

**Pipeline**: `npm run data:full` (одна команда) → `data/oulad/download.js` тягне 47 MB ZIP з figshare → `sample.js` семплює та генерує JSON → `01_oulad_sample.ts` (Knex seed) заливає в БД. Все ідемпотентно, [data/oulad/MAPPING.md](../data/oulad/MAPPING.md) описує кожне поле і його джерело.

## 6. Демо-сценарій

### 6.1 Чотири персони студентів

Створюються свідомо, щоб показати **і чутливість**, і **точність** системи (false-positive і false-negative resistance).

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Тип</td>
		<td>Поведінка</td>
		<td>Скільки осіб</td>
		<td>Що має побачити AI</td>
	</tr>
	<tr>
		<td>**HIGH RISK** ("герой-студент")</td>
		<td>Не здав 2–3 ДЗ підряд; не заходив 5–7 днів; останні повідомлення: "не встигаю", "складно", "мабуть кину"; майже не пише ментору</td>
		<td>1–2</td>
		<td>Виявити негайно, рекомендувати дзвінок + персональну підтримку</td>
	</tr>
	<tr>
		<td>**MEDIUM RISK**</td>
		<td>Активність падає; ДЗ із запізненням; в повідомленнях втома</td>
		<td>3–4</td>
		<td>Виявити, рекомендувати soft-touch (email-нагадування, додатковий матеріал)</td>
	</tr>
	<tr>
		<td>**SILENT BUT OK**</td>
		<td>Мало пише в чаті, але стабільно здає ДЗ і регулярно заходить</td>
		<td>1–2</td>
		<td>**НЕ** позначити як ризиковий — показує, що ми розумніші за просте правило "мовчить = біда"</td>
	</tr>
	<tr>
		<td>**FALSE ALARM**</td>
		<td>Довго не писав, але недавно здав усе добре</td>
		<td>1</td>
		<td>**НЕ** позначити — показує здатність системи переглянути ризик при позитивному сигналі</td>
	</tr>
</table>

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

<table fit-page-width="true" header-row="true">
	<tr>
		<td>#</td>
		<td>Сигнал</td>
		<td>Час до дропауту</td>
	</tr>
	<tr>
		<td>1</td>
		<td>ДЗ із запізненням</td>
		<td>~3–4 тижні</td>
	</tr>
	<tr>
		<td>2</td>
		<td>Пропустив 1–2 уроки з викладачем</td>
		<td>~3 тижні</td>
	</tr>
	<tr>
		<td>3</td>
		<td>Перестав ставити питання в чаті (раніше питав)</td>
		<td>~2 тижні</td>
	</tr>
	<tr>
		<td>4</td>
		<td>Не здав ДЗ взагалі</td>
		<td>~1.5 тижні</td>
	</tr>
	<tr>
		<td>5</td>
		<td>Не заходив у LMS >1 тижня</td>
		<td>~1 тиждень</td>
	</tr>
	<tr>
		<td>6</td>
		<td>Негативні повідомлення: "не встигаю", "складно", "мабуть кину"</td>
		<td>~5–7 днів</td>
	</tr>
	<tr>
		<td>7</td>
		<td>Не відповідає на ПП ментора</td>
		<td><5 днів — "морально пішов"</td>
	</tr>
</table>

**Червона зона** (Nadin): 3+ пропущених ДЗ, 1–2 тижні мовчання в Slack, 2+ модулі відставання від когорти. Після 5–6 етапу повернути дуже складно.

Це підтверджується академічною літературою: Yukselturk & Inan 2008 (**✓**) називають **Top-3 фактори дропауту**: time to study, personal problems, affordability — усі троє корелюють із сигналами 1–4.

## 7. Технологічний стек