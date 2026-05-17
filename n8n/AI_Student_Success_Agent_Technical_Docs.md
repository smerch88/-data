# AI Student Success Agent v2.0
## Технічна документація для Full Stack Java розробника

---

## 📌 Загальний опис системи

Система раннього виявлення ризику відрахування студентів. Аналізує поведінку студентів (логіни, домашні завдання, повідомлення) за допомогою AI агентів і формує рекомендації для менторів.

**Стек:** n8n (workflow automation) + PostgreSQL + Anthropic Claude API

---

## 🗄️ База даних

### Таблиці

| Таблиця | Призначення |
|---------|------------|
| `students_n8n` | Студенти (id, name, course, mentor_id, status) |
| `login_events_n8n` | Логи входів в LMS (student_id, login_date) |
| `homework` | Домашні завдання (student_id, deadline, submitted_at, status, grade) |
| `slack_messages_n8n` | Повідомлення студентів (student_id, message_date, text, to_mentor) |
| `analysis_results` | Результати AI аналізу (risk_score, risk_level, draft_message тощо) |

---

## 🗺️ Загальна схема системи

```
┌─────────────────────────────────────────────────────────────────┐
│                        ЗОВНІШНІ ЗАПИТИ                          │
│                                                                  │
│  POST /planner/batch     POST /planner/analyze                   │
│  (всі студенти)          (один студент)                          │
└──────────┬──────────────────────┬───────────────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌─────────────────────────────────────────┐
│   WF8 Batch      │   │         WF1 Planner (Master)            │
│   Dashboard      │   │                                          │
│                  │   │  Pull Student Context (Postgres)         │
│  Respond 202     │   │  Submission Timing Shift (Postgres)      │
│  Clear Results   │   │  Get Recent Messages (Postgres)          │
│  Get Students    │   │  Load Homework (Postgres)                │
│  Timing Shift    │   │  Attach Homework (Code)                  │
│  Messages All    │   │  Compute All Signals (Code)              │
│  Build Payload   │   │         │                                │
│  Call WF1 ──────────────────────                                │
│  Sort by Risk    │   │         ▼                                │
│  Validate        │   │  HTTP → WF2 Observer Sub-Agent           │
│  Return Batch    │   │         │                                │
└──────────────────┘   │         ▼                                │
                        │  Gate: Severity >= 5?                    │
                        │    │ YES            │ NO                 │
                        │    ▼                ▼                    │
                        │  HTTP → WF3     No Action               │
                        │  Analyst         Save Result            │
                        │    │             Respond                 │
                        │    ▼                                     │
                        │  Gate: Risk >= 40?                       │
                        │    │ YES            │ NO                 │
                        │    ▼                ▼                    │
                        │  HTTP → WF4     No Action               │
                        │  Strategy        Save Result            │
                        │    │             Respond                 │
                        │    ▼                                     │
                        │  Gate: Action?                           │
                        │    │ YES            │ NO                 │
                        │    ▼                ▼                    │
                        │  HTTP → WF5     No Action               │
                        │  Communicator    Save Result            │
                        │    │             Respond                 │
                        │    ▼                                     │
                        │  Aggregate Final Payload (Code)          │
                        │  Clear Student Result (Postgres)         │
                        │  Save Analysis Result (Postgres)         │
                        │  Respond to Webhook                      │
                        └─────────────────────────────────────────┘

┌──────────────────┐   ┌──────────────────┐
│  WF9 Results     │   │  WF10 Status     │
│                  │   │                  │
│  GET /results    │   │  GET /status     │
│  Read from DB    │   │  Read status     │
│  Format JSON     │   │  from DB         │
│  Return          │   │  Return          │
└──────────────────┘   └──────────────────┘
```

---

## 📋 Воркфлоу та їх ноди

---

### WF1 — Planner (Master Orchestrator)

**Призначення:** Головний оркестратор. Приймає запит на аналіз одного студента, збирає дані з БД, координує виклики AI агентів, зберігає результат.

**Endpoint:** `POST /planner/analyze`

**Input:**
```json
{
  "student_id": "stud_292923",
  "trigger": "manual",
  "as_of_date": "2014-05-15"
}
```

| Нода | Тип | Функція |
|------|-----|---------|
| `Receive student_id` | Webhook | Приймає HTTP запит з `student_id` |
| `Pull Student Context` | Postgres | Агрегує дані студента: логіни, ДЗ, повідомлення за один SQL запит |
| `Submission Timing Shift` | Postgres | Визначає чи погіршився паттерн здачі ДЗ (раніше здавав вчасно → тепер із запізненням) |
| `Get Recent Messages` | Postgres | Отримує останні повідомлення студента зі Slack |
| `Load Homework` | Postgres | Завантажує повний список ДЗ студента з оцінками та статусами |
| `Attach Homework` | Code | Об'єднує дані з `Compute All Signals` та `Load Homework` в один об'єкт |
| `Compute All Signals` | Code | Обчислює сигнали ризику: `activity_drop`, `last_login_days_ago`, нормалізує числа |
| `HTTP Request` | HTTP | Викликає WF2 Observer для класифікації сигналів |
| `Gate — Severity Check` | IF | Пропускає до Analyst якщо `max_severity >= 5`, інакше → No Action |
| `HTTP Request: Call Analyst` | HTTP | Викликає WF3 Analyst для глибокого аналізу |
| `GATE: risk_level high/medium?` | IF | Пропускає до Strategy якщо `risk_score >= 40` |
| `HTTP Request: Call Strategy` | HTTP | Викликає WF4 Strategy для плану дій |
| `Gate — Action` | IF | Пропускає до Communicator якщо є рекомендована дія |
| `HTTP Request: Call Communicator` | HTTP | Викликає WF5 Communicator для написання повідомлення |
| `No Action` | Manual | Завершує флоу для низькоризикових студентів |
| `Aggregate Final Payload` | Code | Збирає результати всіх агентів в єдиний JSON |
| `Clear Student Result` | Postgres | Видаляє старий запис студента з `analysis_results` |
| `Save Analysis Result` | Postgres | Зберігає новий результат через `INSERT ... ON CONFLICT DO UPDATE` |
| `Respond to Webhook` | Webhook | Повертає фінальний JSON клієнту |

---

### WF2 — Observer Sub-Agent

**Призначення:** AI агент першого рівня. Класифікує сигнали ризику студента за 7-етапною моделлю dropout, визначає severity кожного сигналу.

**Endpoint:** `POST /observer/run`

| Нода | Тип | Функція |
|------|-----|---------|
| `Observer Trigger` | Webhook | Приймає дані студента від WF1 |
| `Prepare Observer Input` | Code | Формує промпт для AI з числовими сигналами, таблицею ДЗ та повідомленнями |
| `AI Agent` | AI Agent | Claude Sonnet — класифікує сигнали, визначає severity 0-10 для кожного |
| `Parse Observer Response` | Code | Парсить JSON відповідь AI |
| `Calculate Severity Score` | Code | Обчислює `max_severity`, фільтрує активні сигнали |
| `Return Observer Result` | Webhook | Повертає результат до WF1 |

**Output:**
```json
{
  "signals": [{"signal_type": "login_gap", "severity": 9, "details": "..."}],
  "max_severity": 9,
  "sentiment": "critical",
  "has_explicit_dropout_intent": true
}
```

---

### WF3 — Analyst Sub-Agent

**Призначення:** AI агент другого рівня. Розраховує `risk_score` математично, формує `primary_drivers` та `supporting_evidence` на основі реальних даних студента.

**Endpoint:** `POST /analyst/run`

| Нода | Тип | Функція |
|------|-----|---------|
| `Analyst Trigger` | Webhook | Приймає дані студента + результат Observer |
| `Load Homework History` | Postgres | Завантажує повну історію ДЗ студента |
| `Build HW Summary` | Code | Формує зведення ДЗ (total, graded, missed, late, avg_grade), передає `observer_result` далі |
| `Calculate Risk Score` | Code | Математично рахує `risk_score` за формулою: base_score (сигнали) + modifiers (dropout_intent, missed_exam, login_gap) |
| `Prepare Analyst Input` | Code | Формує промпт для AI з повним контекстом студента |
| `Analyst — Risk Analysis` | AI Agent | Claude Sonnet — пояснює причини ризику, формує `primary_drivers`, `supporting_evidence`, `student_state` |
| `Analyst Response` | Code | Парсить JSON відповідь AI |
| `Return Analyst Result` | Webhook | Повертає результат до WF1 |

**Risk Score формула:**
```
base_score  = Σ(stageScores для сигналів з severity >= 5)
modifiers   = dropout_intent(+15) + missed_exam(+15) + login_gap>30(+10) + ...
risk_score  = min(base_score + modifiers, 100)
```

---

### WF4 — Strategy Sub-Agent

**Призначення:** AI агент третього рівня. Розробляє план дій для ментора — яку дію виконати, коли, яку очікувати відповідь.

**Endpoint:** `POST /strategy/run`

| Нода | Тип | Функція |
|------|-----|---------|
| `Strategy Trigger` | Webhook | Приймає дані з WF1 включно з результатом Analyst |
| `Prepare Strategy Input` | Code | Формує промпт для AI |
| `Strategy — Action Plan` | AI Agent | Claude Sonnet — визначає `recommended_action`, `priority`, `timing`, `rationale` |
| `Strategy Response` | Code | Парсить JSON відповідь |
| `Return Strategy Result` | Webhook | Повертає результат до WF1 |

**Output:**
```json
{
  "recommended_action": "mentor_call",
  "secondary_action": "escalation_to_manager",
  "priority": "high",
  "timing": "today",
  "rationale": "..."
}
```

---

### WF5 — Communicator Sub-Agent

**Призначення:** AI агент четвертого рівня. Пише персоналізоване повідомлення студенту та короткий summary для ментора. Без цифр і формальних слів.

**Endpoint:** `POST /communicator/run`

| Нода | Тип | Функція |
|------|-----|---------|
| `Communicator Trigger` | Webhook | Приймає повний контекст студента |
| `Prepare Communicator Input` | Code | Формує промпт для AI |
| `Communicator — Message` | AI Agent | Claude Sonnet (temperature=0.7) — пише `draft_message` та `mentor_summary` |
| `Communicator Response` | Code | Парсить JSON відповідь |
| `Return Communicator Result` | Webhook | Повертає результат до WF1 |

**Output:**
```json
{
  "draft_message": "Богдане, привіт! ...",
  "mentor_summary": "Студент заявив про намір кинути курс...",
  "dashboard_label": "⚠️ Потребує дзвінка від ментора"
}
```

---

### WF8 — Batch Dashboard

**Призначення:** Запускає паралельний аналіз всіх студентів. Відповідає одразу `202 processing`, потім асинхронно обробляє кожного студента через WF1.

**Endpoint:** `POST /planner/batch`

**Input:**
```json
{ "trigger": "force", "as_of_date": "2014-05-15" }
```

| Нода | Тип | Функція |
|------|-----|---------|
| `Batch Dashboard Request` | Webhook | Приймає запит на batch аналіз |
| `Respond to Webhook` | Webhook | Одразу повертає `202 { "status": "processing" }` |
| `Clear Results` | Postgres | Очищає `analysis_results` перед новим аналізом |
| `Get All Active Students` | Postgres | Отримує всіх студентів з агрегованими метриками |
| `Timing Shift All` | Postgres | Розраховує `submission_timing_shift` для всіх студентів одним запитом |
| `Messages All` | Postgres | Завантажує останні повідомлення всіх студентів |
| `Build Batch Payload` | Code | Збирає payload для кожного студента, нормалізує дані |
| `Call Planner per Student` | HTTP | Викликає WF1 для кожного студента (batch=1, interval=15s) |
| `Sort by Risk` | Code | Сортує результати за `risk_score DESC`, групує по ментору |
| `Validate Before Cache` | Code | Перевіряє що дані валідні перед збереженням |
| `List` | Code | Формує скорочений список для дашборду |
| `Return Batch` | Webhook | Повертає фінальний JSON |

---

### WF9 — Results

**Призначення:** Читає збережені результати аналізу з БД і повертає форматований JSON для дашборду.

**Endpoint:** `POST /planner/results`

| Нода | Тип | Функція |
|------|-----|---------|
| `Results Trigger` | Webhook | Приймає запит |
| `DB: Get Analysis Results` | Postgres | `LEFT JOIN analysis_results + students_n8n ORDER BY risk_score DESC` |
| `Code: Format Results` | Code | Формує відповідь з `total`, `high_risk`, `medium_risk`, `low_risk`, `students[]` |
| `Return Results` | Webhook | Повертає JSON |

**Output:**
```json
{
  "total": 15,
  "high_risk": 9,
  "medium_risk": 6,
  "low_risk": 0,
  "students": [...]
}
```

---

### WF10 — Status

**Призначення:** Перевіряє статус batch аналізу.

**Endpoint:** `GET /planner/status`

| Нода | Тип | Функція |
|------|-----|---------|
| `Status Trigger` | Webhook | Приймає запит |
| `DB: Get Status` | Postgres | Читає статус з `dashboard_cache WHERE cache_key = 'batch_status'` |
| `Return Status` | Webhook | Повертає `{ "status": "ready", "completed_at": "..." }` |

---

## 🔄 Потік даних (Data Flow)

```
1. POST /planner/batch
        │
        ▼
   WF8 → Respond 202 → Clear DB → Get Students (15)
        │
        ▼ (для кожного студента, по одному, 15 сек інтервал)
   WF1 → Pull Context + Homework + Messages
        │
        ▼
   WF2 Observer (AI) → severity scores
        │
        ├─ severity < 5 → Save low risk → Done
        │
        ▼
   WF3 Analyst (AI) → risk_score + primary_drivers
        │
        ├─ risk_score < 40 → Save low risk → Done
        │
        ▼
   WF4 Strategy (AI) → recommended_action + timing
        │
        ▼
   WF5 Communicator (AI) → draft_message + mentor_summary
        │
        ▼
   Save to analysis_results (PostgreSQL)

2. POST /planner/results
        │
        ▼
   WF9 → SELECT FROM analysis_results → Format → Return JSON
```

---

## 📊 Risk Score модель

| Score | Level | Urgency | Дія |
|-------|-------|---------|-----|
| 70-100 | 🔴 high | immediate | Дзвінок сьогодні |
| 40-69 | 🟡 medium | this_week | Написати цього тижня |
| 0-39 | 🟢 low | monitor | Спостерігати |

### Сигнали (Observer)

| Сигнал | Severity | Умова |
|--------|---------|-------|
| `negative_messages` | 9 | Фрази "кину курс", "не можу витягнути" |
| `login_gap` | 7-10 | > 14/30/100 днів без входу |
| `missed_homework` | 5-10 | 1/2-3/4-5/6+ пропущених ДЗ |
| `missed_exam` | 8-9 | Пропущений іспит |
| `late_homework` | 4-7 | Запізнення 7-14/14-30/30+ днів |
| `stopped_questions` | 5-6 | Тиша > 7 днів + є пропущені ДЗ |

### Score модифікатори (Analyst)

| Умова | Модифікатор |
|-------|------------|
| `has_explicit_dropout_intent` | +15 |
| `missed_exam` | +15 |
| `missed_hw >= 3` | +10 |
| `login_gap > 30 днів` | +10 |
| `avg_grade < 65` | +5 |
| `missed_hw >= 1` | +5 |

---

## 🌐 API Endpoints

| Метод | URL | Призначення |
|-------|-----|------------|
| POST | `/planner/analyze` | Аналіз одного студента |
| POST | `/planner/batch` | Запуск batch аналізу всіх |
| POST | `/planner/results` | Отримати результати з БД |
| GET | `/planner/status` | Статус batch аналізу |
| POST | `/observer/run` | Observer Sub-Agent (внутрішній) |
| POST | `/analyst/run` | Analyst Sub-Agent (внутрішній) |
| POST | `/strategy/run` | Strategy Sub-Agent (внутрішній) |
| POST | `/communicator/run` | Communicator Sub-Agent (внутрішній) |

---

## ⚙️ Технічні деталі

### AI Моделі

| Агент | Модель | Temperature | Max Tokens |
|-------|--------|------------|------------|
| Observer | Claude Sonnet 4.5 | 0.2 | 800 |
| Analyst | Claude Sonnet 4.5 | 0.1 | 500 |
| Strategy | Claude Sonnet 4.5 | 0.2 | 400 |
| Communicator | Claude Sonnet 4.5 | 0.7 | 600 |

### Batch налаштування

```
Call Planner per Student:
  Items per Batch: 1
  Batch Interval: 15000ms (15 секунд)
  On Error: Continue
  Timeout: 300000ms (5 хвилин)
```

### Обмеження платформи

- **Cloudflare timeout:** 100 сек на webhook запит
- **Рішення:** WF8 відповідає `202` одразу, обробка асинхронна
- **Час batch аналізу:** ~4-7 хвилин для 15 студентів

---

## 🔍 Структура фінального результату

```json
{
  "student_id": "stud_292923",
  "risk_score": 100,
  "risk_level": "high",
  "urgency": "immediate",
  "student_state": "overwhelmed",
  "primary_drivers": ["..."],
  "supporting_evidence": ["..."],
  "recommended_action": "mentor_call",
  "secondary_action": "escalation_to_manager",
  "draft_message": "Богдане, привіт!...",
  "mentor_summary": "Студент заявив про намір...",
  "dashboard_label": "⚠️ Потребує дзвінка від ментора",
  "score_breakdown": {
    "base_score": 70,
    "modifiers": 30,
    "modifier_log": ["dropout_intent: +15", "missed_exam: +15"],
    "total": 100
  }
}
```
