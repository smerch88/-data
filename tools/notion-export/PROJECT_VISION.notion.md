# EdTech Retention Platform — концепція і план

> Цей документ — продуктово-технічна основа для проекту, який команда готує на хакатон з дедлайном 18 травня 2026 і подальший розвиток у пілотний продукт. Будується поверх скелета з кореневого `CLAUDE.md` (Postgres + Node/TS бекенд) + n8n для AI-оркестрації. Майбутні сесії Claude Code мають читати цей файл перед прийняттям продуктових/архітектурних рішень.

## TL;DR для Claude

- **Що будуємо в хакатоні (10 днів)**: мульти-агентну AI-систему, що моніторить онлайн-школу через дані з LMS і Slack, виявляє учнів у ризику відтоку, пояснює причину, і генерує персональний message-draft для повернення. Multi-agent — це **архітектурне ядро**, без AI продукт не існує (відповідає критерію журі: AI-імплементація = 25% оцінки).
- **Кому продаємо**: українські онлайн-школи з 100–5000 активних учнів — GoIT, Hillel (**✓ verified**), Projector, Prometheus, LearnLifeLong тощо. Кожен втрачений учень = $400–2000 доходу (на основі ринкових цін українських IT-курсів — див. **Hillel proof** + 3-тижневе refund-вікно як direct revenue exposure школи) + репутаційні ризики. Industry-wide signal: **EdTech має найвищий B2B SaaS churn — 9.6%/міс** (**✓ verified**).
- **Чому тільки multi-agent а не ML+LLM-гібрид**: команда з 7 людей, ~10 днів після роботи, обмежений ресурс на debug + data labeling. Multi-agent через n8n працює з першого дня без training data. ML-шар (XGBoost + SHAP як попередній фільтр перед агентами) свідомо **відкладений на post-hackathon roadmap** для оптимізації unit economics. На OULAD benchmark XGBoost дає F1=0.92 / AUC=0.97 (**✓ verified**) — реалістична ціль для post-hackathon ML-шару.
- **Що НЕ робимо в хакатоні**: класична ML-модель churn-prediction; survival analysis; uplift modeling; SHAP-feature attribution; production-ready scoring engine. Усе це в roadmap, але не в demo.
- **Чим відрізняємось від MAIC ([arxiv 2508.17310](https://arxiv.org/abs/2508.17310), Aug 2025) і EdSights**: MAIC = closed AI classroom; EdSights = SMS-chatbot для US universities. Ми = **agent-as-observer над heterogeneous LMS+Slack** + **tone-of-voice draft в стилі школи** + **B2B для онлайн-шкіл 100–5,000 учнів** (underserved middle). Деталі — §2.3.

## 1. Концепція

### Проблема (з польової експертизи: Nadin — ментор GoIT)
Онлайн-школи фізично не можуть відстежити кожного учня. Ментор з 100–500 студентів помічає, що учень "відвалюється", уже постфактум — коли той пропустив 2–3 ДЗ, перестав заходити в LMS і не відповідає на повідомлення. Школа втрачає $400–2000 доходу за кожного, плюс репутацію через NPS і word-of-mouth.

### Job-to-be-done (для School / Course Manager)
> "Знайди мені 5–10 учнів, які зараз потребують уваги, поясни конкретно, в чому проблема кожного, і дай готову персональну дію — щоб я міг витратити 30 хвилин замість 3 годин і повернути учня **до того**, як він морально пішов."

### Ціннісна метрика
% зменшення **churn** або % збільшення **completion rate**. Все інше — proxy.

### Емпіричний baseline проблеми
- **EdTech B2B SaaS — найвищий monthly churn серед усіх вертикалей: ~9.6%/міс** (industry benchmarks 2026, [Artisan Strategies](https://www.artisangrowthstrategies.com/blog/saas-churn-rate-benchmarks-2026-500-companies)) **✓ verified**. Це **commercial signal сильніший за академічні MOOC-цифри** — проблема industry-wide, не anecdotal. Customer churn доударів 11% → 22% YoY у деяких сегментах.
- **MOOC median completion rate: 12.6%** (Jordan 2015 IRRODL, 221 курсів) — **✓ verified**. Newer revisit ([Open Praxis 2024](https://openpraxis.org/articles/10.55982/openpraxis.16.3.606)) підтверджує діапазон.
- **Distance education dropout: 30–50%** (US літературний consensus; Європа 20–30%; Азія до 50%) — **✓ verified**.
- **Online dropout vs offline: на 10–20% вищий, у деяких студіях — у 6–7 разів** (Christensen & Spackman 2017) — **✓ verified**.
- **2024 systematic review of 110 articles on online HE dropout** ([Springer 2024](https://educationaltechnologyjournal.springeropen.com/articles/10.1186/s41239-024-00450-9)) **✓ verified**: 5 pillars предикторів — demographic, course-related, technology-related, motivational, support-related. **Strongest log-based predictors**: days-since-last-access, log frequency, activity types. **Це прямо валідує signal sequence Nadin (§6.3)** — академія підтверджує польову експертизу.
- **Перші 1–2 тижні курсу — критичні**: після них активність stabilизується (різниця <3% у наступні тижні) — Jordan 2015. Це задає вікно для нашого моніторингу. Cross-confirm: Hillel **має refund-вікно 3 тижні** — школи самі визнають критичність першого місяця.

### Чому AI multi-agent — це наукова база, не маркетинг

- **Сучасний tutoring meta-analysis (Nickow, Oreopoulos & Quan 2020/2024)** **✓ verified**: NBER meta-analysis 96 RCT/quasi-experimental tutoring-програм PreK-12 → pooled effect size **0.37σ** (≈14 percentile points). Жодне з 96 досліджень не відтворило класичний Bloom 2.0σ — це **наш чесний baseline**, а не маркетинговий 2σ.
- **Bloom's 2-sigma problem (1984)** **✓ verified**: історичний орієнтир (50-й → 98-й перцентиль) **сильно оспорений модерними реплікаціями**. Оригінальний 2σ-ефект частково зумовлений mastery-threshold дизайном (tutees мали 90% бар, control — без бару). Залишаємо як rhetorical anchor для проблеми "scalable 1:1", не як обіцянку ефекту.
- **VanLehn 2011** **✓ verified**: human tutors → **0.79σ**, step-based ITS → **0.75σ**, answer-based ITS → 0.31σ. Тобто реальні AI-tutors статистично близькі до експертів-людей, але не до Bloom-овського 2σ.
- **Modern ITS meta-analysis (Kulik & Fletcher 2016)** **✓ verified**: 50 контрольованих експериментів → median ES **0.66σ** (50-й → 75-й перцентиль), перемога у 92% порівнянь. **Caveat**: на локально розроблених тестах ES 0.73, на стандартизованих — лише **0.13**. K-12 контекст показав мінімальний reliable improvement (3 школи в meta).
- **Реалістичний таргет нашого продукту**: 10–18% reduction in dropout у пілоті. Підстава: ES 0.37–0.66σ (Nickow + Kulik) × часткове експозування ефекту через message-draft (не повноцінний tutoring) + 30–50% baseline dropout (ERIC). Зважено-консервативний розрахунок: ~3–8 п.п. абсолютного зниження. **На презентації говоримо 10–15%, не 15–25%.**

## 2. Диференціація проти конкурентів

### 2.1 Commercial SaaS competitors

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Конкурент</td>
		<td>Що робить</td>
		<td>Чого НЕ робить (наша ніша)</td>
	</tr>
	<tr>
		<td>**EdSights** ([edsights.com](https://www.edsights.com/)) **✓ verified**</td>
		<td>SMS-chatbot для at-risk students; **250+ університетів** (live site, 2026-05-09); ціна **$5–$15/student/year** (2020 reference, не на live site); +7% retention в середньому; 62% engagement rate, 100+ мов</td>
		<td>Single-channel (SMS), single-institution focus (US universities), не аналізує реальні Slack/LMS-чати студентів між собою; не observation-based — chatbot тільки **запитує**, наш Спостерігач **слухає** реальні розмови без додаткових опитувань</td>
	</tr>
	<tr>
		<td>**Civitas Learning + Starfish** ([civitaslearning.com](https://www.civitaslearning.com/platform/)) **✓ verified**</td>
		<td>Student Impact Platform для US higher ed; institution-specific data + real-time insights + coordinated workflows</td>
		<td>Enterprise-only (university-scale 5k–50k students); пакет коштує $$$$ (implementation fee + annual licensing); не для онлайн-шкіл 100–5,000 учнів</td>
	</tr>
	<tr>
		<td>**Mixpanel / Amplitude / Heap**</td>
		<td>Generic product analytics, churn-дашборди</td>
		<td>Не EdTech-aware, не пропонують intervention, тільки графіки</td>
	</tr>
	<tr>
		<td>**Gainsight / ChurnZero**</td>
		<td>Customer Success платформи з NLP-скорингом</td>
		<td>Корпоративні (mid-market $10K–$25K+/year, enterprise $20K–$60K+/year — **G2/Capterra estimates**); не для онлайн-шкіл з 100–500 учнів; B2B SaaS focus, не EdTech-specific</td>
	</tr>
	<tr>
		<td>**Вбудована аналітика Thinkific / Teachable / Kajabi**</td>
		<td>Метрики логінів, прогрес курсу</td>
		<td>Базова, без розуміння причин, без AI-driven дії</td>
	</tr>
	<tr>
		<td>**PowerSchool Naviance + PowerBuddy** ([powerschool.com](https://www.powerschool.com/solutions/college-career-and-life-readiness/naviance-cclr/))</td>
		<td>K-12 platform, **35% of US high schools / 8M students**; 2025-26 додає AI-помічника</td>
		<td>K-12 only, US-locked, college-prep focus; не для дорослих online learners</td>
	</tr>
	<tr>
		<td>**Ручний моніторинг (Excel + Slack-нотатки ментора)**</td>
		<td>Все робиться руками</td>
		<td>Не масштабується; школа з 1000+ учнів фізично не може відстежити кожного</td>
	</tr>
</table>

### 2.2 Academic prior art (2024–2025)

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Робота</td>
		<td>Що робить</td>
		<td>Чим ми відрізняємось</td>
	</tr>
	<tr>
		<td>**MAIC — Massive AI-empowered Course** ([arxiv 2508.17310](https://arxiv.org/abs/2508.17310), Aug 2025) **✓ verified**</td>
		<td>LLM multi-agent classroom (AI Teacher + AI TAs + Simulated Peers + Personalized Email Recall Agent); CPADP framework; PLM+MLP achieves **95.4% accuracy / F1=0.935** на >3,000 students; +78.6% re-logins claim **(методологічно слабкий: n=17, 6 days, no control group)**</td>
		<td>**Закрита AI-classroom** — MAIC замінює викладача, ми **спостерігаємо існуючу школу зовні**. Наш agent читає реальні Slack/LMS-події між живим ментором і живим студентом. MAIC не вирішує B2B-онбоардинг для шкіл, які вже мають викладачів</td>
	</tr>
	<tr>
		<td>**From MOOC to MAIC** ([arxiv 2409.03512](https://arxiv.org/abs/2409.03512), 2024)</td>
		<td>Foundational paper для LLM-driven course agents</td>
		<td>Проектує всю pedagogy навколо AI; ми додаємо **action layer поверх існуючої pedagogy**, не реплейсимо її</td>
	</tr>
	<tr>
		<td>**AI instructional agent RCT** ([arxiv 2505.22526](https://arxiv.org/html/2505.22526v1), May 2025)</td>
		<td>RCT доводить, що AI-agent покращує perceived learner control</td>
		<td>Підтверджує наш напрям, але не закриває нашу нішу: external observation + draft → human Send</td>
	</tr>
</table>

### 2.3 Наша унікальна позиція (wedge)

Ми **не tutor-replacement** і **не chatbot**. Ми **agent-as-observer над heterogeneous data plane** + **human-in-the-loop action layer**. Чотири фічі, які жоден з вище-перелічених не комбінує:

1. **Cross-channel observation**: агент читає Slack DM + group chat + support channel + LMS events як єдиний стрім, корелює signals 1–7 (§6.3). EdSights/Civitas → single channel; MAIC → closed classroom.
2. **Heterogeneous LMS/Slack tenant**: побудовано так, що школа підключає **свої** Thinkific/Teachable/Moodle/custom LMS і **свій** Slack/Discord без міграції на нашу платформу. EdSights/Civitas/PowerSchool → проприетарна платформа.
3. **Tone-of-voice agent (Комунікатор)**: draft message пишеться **в стилі конкретної школи** (configurable). EdSights → стандартний chatbot tone; MAIC → universal AI prompt; Civitas → workflow templates без AI-генерації тексту.
4. **False-positive resistance by design**: 4-persona test set (HIGH/MEDIUM/SILENT-BUT-OK/FALSE-ALARM, §6.1) перетинається з реальними OULAD `final_result` категоріями. **Доводимо журі і клієнтам не лише "ловить ризик", а й "не флагує невинних"** — вимога, яку single-channel chatbot-и обходять стороною.
5. **B2B segment "underserved middle"**: 100–5,000 students → надто малий для Civitas/Starfish (university scale), надто великий для Excel-ментора. EdSights в цьому сегменті ходить, але через US universities — **український/EU мід-сегмент онлайн-шкіл відкритий**.

**Однорядковий pitch**: ми будуємо те, що Civitas Learning робить для університетів, **в B2B-форматі для онлайн-шкіл 100–5,000 учнів**, з **observation-mode multi-agent поверх живої Slack/LMS-економіки** замість запитів-через-chatbot.

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

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Шар</td>
		<td>Інструмент</td>
		<td>Чому</td>
	</tr>
	<tr>
		<td>Backend API</td>
		<td>Node.js + TypeScript (Express + Knex)</td>
		<td>Скелет уже в репо</td>
	</tr>
	<tr>
		<td>БД</td>
		<td>PostgreSQL</td>
		<td>Half-real mock з OULAD ([MAPPING.md](../data/oulad/MAPPING.md))</td>
	</tr>
	<tr>
		<td>**AI Orchestration**</td>
		<td>**n8n**</td>
		<td>Visual workflow для агентів; команда (Дмитро + Микола) комфортна з low-code AI-flow</td>
	</tr>
	<tr>
		<td>LLM</td>
		<td>Claude (Sonnet 4.6+ або Opus 4.5+) через API</td>
		<td>Особиста підписка Arsenii ($100/міс), вистачить лімітів</td>
	</tr>
	<tr>
		<td>Frontend</td>
		<td>Next.js + Tailwind + shadcn + Tremor + Recharts</td>
		<td>Швидко, сучасно, OSS</td>
	</tr>
	<tr>
		<td>Auth</td>
		<td>Clerk (free tier 50k MRUs — **✓**)</td>
		<td>Не писати з нуля</td>
	</tr>
	<tr>
		<td>Hosting</td>
		<td>VPS Arsenii (для демо); production пізніше — Render / Railway</td>
		<td>Дешево, контрольовано</td>
	</tr>
	<tr>
		<td>Email/Slack delivery (post-hackathon)</td>
		<td>Resend / Slack Web API</td>
		<td>Не пріоритет на демо</td>
	</tr>
</table>

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

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Людина</td>
		<td>Роль</td>
		<td>Зона відповідальності</td>
	</tr>
	<tr>
		<td>**Arsenii**</td>
		<td>Frontend + Backend Lead + AI Integration</td>
		<td>Дашборд, оркестрація агентів, API, інтеграція AI у продукт. Хост на власному VPS.</td>
	</tr>
	<tr>
		<td>**Дмитро + Микола**</td>
		<td>AI Agents Engineer + n8n Orchestration</td>
		<td>Тригери, воркфлоу, промпти, логіка кожного агента, інтеграція з Claude API</td>
	</tr>
	<tr>
		<td>**Олексій + Маргарита**</td>
		<td>Data Analytics</td>
		<td>Sampling/мапінг OULAD на нашу схему, валідація 4 персон, метрики дашборду (поточний sample вже залитий — наступне: розширення scenarios + uplift baseline)</td>
	</tr>
	<tr>
		<td>**Гюльзар**</td>
		<td>Product Designer (UX)</td>
		<td>Дизайн дашборду, екранів профілю, demo-flow візуально</td>
	</tr>
	<tr>
		<td>**Еріка**</td>
		<td>AI Content + Presentation</td>
		<td>Tone-of-voice для агента-Комунікатора, шаблони повідомлень, презентація, відео-демо</td>
	</tr>
	<tr>
		<td>**Nadin**</td>
		<td>Tech Lead / BA</td>
		<td>Координація, ТЗ, польова експертиза EdTech (досвід ментора GoIT), підхват у Arsenii</td>
	</tr>
</table>

## 9. Архітектура — Post-Hackathon Roadmap

> Усе нижче — **НЕ в хакатоні**. Це бачення, як еволюціонує продукт після demo. У презентації показуємо як план розвитку.

### 9.1 ML-шар як попередній фільтр

Гібридна архітектура: класична ML-модель швидко скорить **усіх** учнів, multi-agent глибоко аналізує **тільки топ-ризикових** (наприклад, top-20% за score). Це дає:
- **Економія 75–85% на витратах AI** (агенти бачать тільки 20% бази).
- **Масштабованість до 10k+ учнів** без exploding cost.
- **Маржа 70–80%** на рівні школи з 1000+ учнів.
- **"Класичний" tier** для клієнтів, які бояться LLM-обробки (для шкіл з compliance-обмеженнями).

Стек ML-шару:
- **XGBoost / LightGBM** (**↗**) — baseline на табличних фічах.
- **SHAP feature attribution** (**↗**) — пояснення скорів, передається агенту-Аналітику як контекст.
- **Survival analysis (Cox / DeepSurv)** (**↗**) — для прогнозу "коли" дропне, не лише "чи".
- **Uplift modeling** (**↗**) для action layer — щоб цілитися у Persuadables, не у Sleeping Dogs (див. **§11.3**).

### 9.2 Re-platforming agent orchestration (коли n8n впирається)

n8n чудовий для хакатона і перших 5–10 клієнтів, але має задокументовані обмеження для production multi-agent ([n8n blog — Multi-agent systems](https://blog.n8n.io/multi-agent-systems/), [MindStudio — n8n vs agentic workflows](https://www.mindstudio.ai/blog/n8n-vs-agentic-workflows-when-to-use-each)) **⚠️ partial**:

- **Coordination overhead, quality drift, token explosion** — verbatim categories з n8n blog.
- **Tool-calling failure modes** — failed tool calls можуть ламати workflow; security risks при додаванні tools.
- **Complexity ceiling** — за emerging engineering consensus (Anthropic, OpenAI, Cognition AI), **5–7 tools per agent — sweet spot**; джерело — [Anthropic engineering docs](https://www.anthropic.com/engineering), не сам n8n. Перевіряти при scale.
- **n8n не проектувався для глибокого autonomous orchestration** — для 4 агентів і shallow handoffs OK, для 10+ агентів і circular reasoning потрібно re-platforming.

**Trigger для re-platforming**: коли підключаємо 10-го клієнта **АБО** додаємо 5+ агента, мігруємо на code-based framework (LangGraph / CrewAI / custom Python). Цей перехід вже закладений у roadmap (§13, "ML-шар" фаза) — **не surprise risk**.

### 9.3 Реальні інтеграції

- **LMS webhooks**: Thinkific, Teachable, Kajabi, Moodle, custom — кожна нова = 1–3 тижні роботи.
- **Slack / Discord APIs** — для агента-Спостерігача в реальних чатах.
- **Stripe / Recurly** — для signal "downgrade / failed payment".
- **Mailchimp / Resend** — для відправки агентом-Комунікатором.

### 9.4 A/B testing engine
RCT-розбивка з самого початку action layer: треба довести **uplift від інтервенцій**, не просто accuracy churn-моделі. Це і буде real product moat (див. **§11**). Прямий приклад в нашій галузі: [Sciencedirect — Uplift Modeling for preventing student dropout](https://www.sciencedirect.com/science/article/pii/S0167923620300750) — RCT-data + uplift-modelling показує, що persuadable-targeting знижує dropout сильніше за propensity-targeting.

### 9.5 Modes продукту

- **Окремий продукт** (SaaS, $300–500/міс підписка). Це попадає в "underserved middle" між безкоштовною Excel-таблицею ментора і enterprise-CSP типу Gainsight, який починається від $1000/міс і вище (**✓ verified** — pricing непублічне; цифри з G2/Capterra). Default для хакатона.
- **Модуль / API** для інтеграції в існуючі LMS-платформи (B2B2C через Thinkific/Teachable). Архітектурно одразу будуємо так, щоб обидва формати були можливі.
- **Партнерство з платформами** під їхнім брендом (white-label).
- **Пілот за сегментом** (тільки бізнес-курси, тільки bootcamps).

## 10. Бюджет

### 10.1 Хакатон (10 днів)

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Стаття</td>
		<td>Сума</td>
		<td>Хто покриває</td>
	</tr>
	<tr>
		<td>Claude API на демо</td>
		<td>**~$10**</td>
		<td>особистий Arsenii</td>
	</tr>
	<tr>
		<td>Claude підписка</td>
		<td>$100/міс — вже є</td>
		<td>особистий Arsenii</td>
	</tr>
	<tr>
		<td>VPS (Ubuntu 24.04, 96 GB / 5.8 GB RAM)</td>
		<td>вже є</td>
		<td>особистий Arsenii</td>
	</tr>
	<tr>
		<td>Домен `my-own-testing.space`</td>
		<td>вже є</td>
		<td>особистий Arsenii</td>
	</tr>
	<tr>
		<td>HTTPS-cert (Let's Encrypt / ZeroSSL)</td>
		<td>$0 — auto-issuance через Caddy</td>
		<td>—</td>
	</tr>
	<tr>
		<td>**Разом грошового видатку команди**</td>
		<td>**~$10** (Claude API на час хакатона)</td>
		<td>Arsenii</td>
	</tr>
</table>

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

- Claude Sonnet **$3/M input, $15/M output** (**✓ verified**). Реалістично на повноцінному multi-agent pipeline: **~$200–400/міс на середню школу 500 учнів**.
- Гібрид з ML-шаром (агенти тільки на top-20%) — **~$40–80/міс на ту ж школу**.
- На старті — first-party API. Self-hosted моделі (Llama / Qwen / Mistral через **vLLM**) дешевші тільки при постійному навантаженні.

## 11. Емпіричний фундамент

Цифри, на які спирається продуктова логіка. Усі — з академічних джерел через `tools/proof-researcher` (proofs у `docs/proofs/empirical/`). Wikipedia-джерела доповнено первинними академічними публікаціями.

### 11.1 Дропаут і completion rate (primary academic sources)

- **Median MOOC completion rate: 12.6%** (range 0.7%–52.1%) на 221 курсах. Перші 1–2 тижні — критичні: після них активність stabilises (різниця <3% у наступні тижні). — Jordan 2015 IRRODL **✓ verified**.
- **edX 6.002x (перший edX курс): <5% completion** з 154,763 enrolled. — Breslow et al. 2013 **✓ verified**.
- **Distance education dropout: 30–50%** (літературний consensus у US; Європа 20–30%; Азія до 50%). Top-3 фактори дропауту з survey: time to study, personal problems, affordability. — Yukselturk & Inan 2008 **✓ verified**.
- **Online dropout vs offline: на 10–20% вищий, у деяких студіях — у 6–7 разів**. Концепт **Course Walls** — модулі, де студенти масово застрягають. — Christensen & Spackman 2017 **✓ verified**.
- **Harvard/MIT MOOC, 2012: 22% completion** average — Ho, Reich et al. HarvardX/MITx report через Wikipedia **✓ verified**.
- **Висновки для нашого продукту**:
  - Feature engineering ML-моделі (post-hackathon) має давати **перші 2 тижні × 3–5 більше ваги**.
  - **Course Walls** як окрема product-фіча: знаходити модулі, де когорта застрягає, повідомляти школу. Реалізовується агентом-Аналітиком.

### 11.2 Точність ML-моделей дропауту

- **OULAD benchmark (наш dataset)**: 2024 systematic literature review ([Springer 2024](https://link.springer.com/chapter/10.1007/978-3-031-64315-6_46)) consolidує 17 articles (2017–2024); типове цільове "ceiling" для XGBoost-class models на OULAD — приблизно **F1 ≈ 0.90+, AUC ≈ 0.95+**. **⚠️ partial** (ID/PRISMA verified; точні числа за Springer paywall). **Це наш orientational target для post-hackathon ML-шару** — не Whitehill MOOC, а саме OULAD-specific діапазон.
- **MAIC CPADP framework** ([arxiv 2508.17310](https://arxiv.org/abs/2508.17310)): fine-tuned PLM + MLP classifier на >3,000 students → **95.4% accuracy / F1 = 0.935**. GPT-4 few-shot baseline у тій же роботі — лише 77.9% / F1 = 0.604. **Висновок**: на тих самих даних ML-fine-tune перевершує pure-LLM на 17 п.п. accuracy → це підтверджує наш roadmap §9.1 (ML-as-prefilter, LLM-as-deep-analysis), а не pure-LLM-only архітектуру.
- **AUC 87.33% production / 90.20% post-hoc** на 40 HarvardX MOOCs за 8 тижнів. Розрив 2.87 п.п. AUC між тестовим стендом і production-режимом. 5-layer NN значно кращий за logistic regression. — Whitehill et al. 2017 **✓ verified**.
- **Стандартні метрики churn-моделі**: AUC + Top Decile Lift; подвійна мета — predictive performance + interpretability. — De Caigny et al. 2018 **✓ verified**.
- **Moodle log-data CatBoost (2025)** **✓ verified**: [Nature Sci Reports 2025](https://www.nature.com/articles/s41598-025-93918-1) — CatBoost на student activity logs підтверджує tree-based gradient boosting як state-of-the-art для tabular dropout prediction. Reinforces наш ML-stack choice.
- **Висновок**: реалістичний таргет 85–95% AUC / 0.85+ F1 за достатнього обсягу даних (OULAD-grade quality); перші клієнти отримають нижчий performance до накопичення training data — мітигується heuristic baseline на старті.

### 11.3 Чому uplift-modeling ≠ churn-prediction

- **4 сегменти юзерів** (**↗**): Persuadables / Sure Things / Lost Causes / Sleeping Dogs. Тільки **Persuadables** дають incremental ROI. — Lo 2002, Radcliffe 2007, через Wikipedia **✓ verified**.
- **Sleeping Dogs ефект**: retention-кампанії документовано **підвищують** churn серед "сплячих" клієнтів у telco і financial services.
- **Слідство**: traditional churn-prediction цілить у Sure Things (висока ймовірність churn ≠ висока ймовірність response). Uplift-модель — у Persuadables. Це різні objective functions.
- **Висновок**: для post-hackathon action layer треба **uplift, не пропенсіті**.

### 11.4 Контекст ринку

- **Coursera**: 168M юзерів (2024), $694.7M revenue, **net loss $79M** — навіть лідер не вирішив unit economics. — **✓ verified**.
- **edX**: 83M юзерів (2023); материнська 2U подала Chapter 11 у липні 2024. — **✓ verified**.
- **US online learning**: 7.5M онлайн-студентів (2024); 53%+ постграду беруть хоча б один онлайн-курс. — **✓ verified**.
- **Coding bootcamps**: 8–36 тижнів (середнє 12.9), ціна $0–$21k (середнє $11,874), deferred tuition 18–22.5% зарплати. — **✓ verified**.
- **Distance learning** дропаут drivers (research consensus): self-regulation, time management, language, technology — **✓ verified**.
- **Висновок**: retention/conversion болить навіть на масштабі 80M+ юзерів — проблема не вирішена, ринок існує.

## 12. Ризикові зони

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Зона</td>
		<td>Що показує література / польова експертиза</td>
		<td>Як ми мітигуємо в хакатоні</td>
	</tr>
	<tr>
		<td>**Direct prior art (MAIC, arxiv 2508.17310)**</td>
		<td>LLM multi-agent + dropout intervention вже опубліковано Aug 2025 з 95.4% accuracy</td>
		<td>MAIC = closed AI classroom з AI-Teacher; ми = **observation-mode над живими школами**. Журі може побачити MAIC у пошуку — на презентації **самі** проактивно цитуємо MAIC і пояснюємо різницю (§2.3 wedge)</td>
	</tr>
	<tr>
		<td>**Direct commercial competitor (EdSights, $5–$15/student)**</td>
		<td>140+ universities US ринок зайнятий</td>
		<td>EdSights = SMS-chatbot, single-channel; ми = cross-channel observer. Ринковий segment EU/UA онлайн-шкіл відкритий — EdSights туди не локалізований</td>
	</tr>
	<tr>
		<td>Multi-agent ловить глюки і бага</td>
		<td>n8n + Claude може давати unstable output, **n8n має задокументовані orchestration-обмеження** (**✓**)</td>
		<td>Жорсткі structured outputs (JSON schema), evals на 4 demo-персонах перед finalізацією. Re-platforming у LangGraph/CrewAI заплановано на 10-го клієнта (§9.2)</td>
	</tr>
	<tr>
		<td>LLM hallucinations у Comunікатор-агенті</td>
		<td>Будь-яка LLM може вигадати факти про учня</td>
		<td>Завжди як **draft**; menедж натискає Send. Контекст агента — тільки реальні поля з БД, не свободна інтерпретація. Khanmigo cautionary tale (**⚠️ partial**) — навіть Khan Academy показав лише **6.1pp improvement** на next-item correctness; lower-performing students почти не отримали gains</td>
	</tr>
	<tr>
		<td>Сильна презентація > слабкий код</td>
		<td>Команда має 10 днів і денну роботу</td>
		<td>Nadin: фокус на стабільне demo + сильна презентація, не на технічну глибину. Складні фічі (uplift, ML) — у roadmap, не в demo</td>
	</tr>
	<tr>
		<td>Дані half-real → демо неправдоподібне</td>
		<td>Журі може помітити "штучність" сценаріїв</td>
		<td>Поведінкова частина (homework deadlines, submission dates, grades, registration) — реальна з OULAD (32k студентів Open University); тільки чати + імена синтетичні. 4 типи персон (включно з false-positive resistance: SILENT BUT OK + FALSE ALARM) — з реальних `final_result` категорій. Повний transparent-mapping у [MAPPING.md](../data/oulad/MAPPING.md) для аудиту журі.</td>
	</tr>
	<tr>
		<td>Якість ML на малих/брудних даних (post-hackathon)</td>
		<td>Production AUC ~3 п.п. нижчий за post-hoc</td>
		<td>На хакатоні немає ML — це не ризик. Post-hackathon: heuristic baseline → ML тільки після ≥5–10 клієнтів × ≥6 міс даних</td>
	</tr>
	<tr>
		<td>Compliance (GDPR / FERPA / COPPA)</td>
		<td>Юридична частина не вирішується інженерно</td>
		<td>На хакатоні — OULAD (повністю анонімізований ARX-tool, CC BY 4.0, peer-reviewed Nature) + синтетичні чати. Нульовий compliance-ризик, коректна атрибуція в [MAPPING.md](../data/oulad/MAPPING.md). Юрист на ретейнер з 6-го місяця для real-LMS інтеграцій.</td>
	</tr>
	<tr>
		<td>SOC 2 Type II (post-hackathon, enterprise)</td>
		<td>6–12 міс процесу</td>
		<td>Старт SOC 2 — 9–10 місяць roadmap</td>
	</tr>
</table>

**Найризикованіше місце MVP**: довести uplift від інтервенцій RCT-тестом, а не просто accuracy моделі. На хакатоні цього не показуємо — у roadmap.

## 13. Roadmap

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Етап</td>
		<td>Дати</td>
		<td>Вихід</td>
	</tr>
	<tr>
		<td>**Хакатон demo**</td>
		<td>9–18 травня 2026</td>
		<td>Multi-agent система + dashboard + 4 демо-персони + презентація + відео</td>
	</tr>
	<tr>
		<td>**Перші пілотні школи**</td>
		<td>травень–червень 2026</td>
		<td>1–2 школи (через знайомства Nadin у GoIT) тестують на реальних даних</td>
	</tr>
	<tr>
		<td>**ML-шар**</td>
		<td>липень–вересень 2026</td>
		<td>XGBoost + SHAP як попередній фільтр перед агентами; гібридна архітектура</td>
	</tr>
	<tr>
		<td>**A/B testing engine + uplift**</td>
		<td>жовтень–грудень 2026</td>
		<td>Доказ incremental retention на A/B тесті з 1 школою</td>
	</tr>
	<tr>
		<td>**Scale + диференціація**</td>
		<td>2027 Q1–Q2</td>
		<td>Marketplace listings (Thinkific/Teachable), self-serve onboarding, $20–50k MRR</td>
	</tr>
	<tr>
		<td>**Enterprise readiness**</td>
		<td>2027 Q3–Q4</td>
		<td>SSO, audit logs, multi-tenant guarantees, self-hosted LLM, перші enterprise-угоди ($1000+/міс)</td>
	</tr>
</table>

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

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Тип курсу</td>
		<td>Цифра</td>
		<td>Primary source</td>
		<td>Proof</td>
	</tr>
	<tr>
		<td>MOOC (median, 221 курсів)</td>
		<td>**12.6%** completion (range 0.7%–52.1%); перші 1–2 тижні критичні</td>
		<td>**Jordan 2015 IRRODL** (peer-reviewed)</td>
		<td>[jordan-2015-irrodl](proofs/empirical/jordan-2015-irrodl/notes.md)</td>
	</tr>
	<tr>
		<td>edX 6.002x (перший edX курс)</td>
		<td>**<5%** completion з 154,763 enrolled</td>
		<td>**Breslow et al. 2013** (Research & Practice in Assessment)</td>
		<td>[breslow-edx-2013](proofs/empirical/breslow-edx-2013/notes.md)</td>
	</tr>
	<tr>
		<td>Distance education (US консенсус)</td>
		<td>Dropout **30–50%** (Європа 20–30%; Азія до 50%); top-3 драйвери: time, personal, affordability</td>
		<td>**Yukselturk & Inan 2008** (ERIC ED494345)</td>
		<td>[eric-distance-ed](proofs/empirical/eric-distance-ed/notes.md)</td>
	</tr>
	<tr>
		<td>Online dropout vs offline</td>
		<td>На **10–20% вищий**; у деяких студіях у **6–7 разів**; концепт Course Walls</td>
		<td>**Christensen & Spackman 2017** (Journal of Educators Online)</td>
		<td>[eric-online-vs-offline](proofs/empirical/eric-online-vs-offline/notes.md)</td>
	</tr>
	<tr>
		<td>MOOC (Katy Jordan website, історична)</td>
		<td>15% (max ~40%), типовий enrollment 25,000</td>
		<td>Katy Jordan dataset (через web archive) — cross-check</td>
		<td>[katy-jordan-mooc](proofs/empirical/katy-jordan-mooc/notes.md)</td>
	</tr>
	<tr>
		<td>Harvard/MIT MOOC, 2012</td>
		<td>22% completion average; Tasmania "Understanding Dementia" 39%</td>
		<td>Wikipedia: MOOC (cited Ho, Reich et al.)</td>
		<td>[mooc-wiki](proofs/empirical/mooc-wiki/notes.md)</td>
	</tr>
	<tr>
		<td>Coding bootcamps</td>
		<td>Тривалість 8–36 тижнів (середня 12.9); ціна $0–$21k (середня $11,874); deferred tuition 18–22.5% зарплати</td>
		<td>Wikipedia: Coding bootcamp + Course Report 2017</td>
		<td>[coding-bootcamp-wiki](proofs/empirical/coding-bootcamp-wiki/notes.md)</td>
	</tr>
	<tr>
		<td>Coding bootcamps 2026 ринок</td>
		<td>Топ-26 bootcamps (Le Wagon, Springboard, TripleTen ...), CIRR-стандарт outcomes; AI-tools уже інтегровані</td>
		<td>Course Report (2026 listing, верифіковано)</td>
		<td>[coursereport-bootcamps](proofs/empirical/coursereport-bootcamps/notes.md)</td>
	</tr>
	<tr>
		<td>Distance learning драйвери</td>
		<td>Self-regulation, time management, language, technology</td>
		<td>Wikipedia: Distance education (cross-check)</td>
		<td>[distance-education-wiki](proofs/empirical/distance-education-wiki/notes.md)</td>
	</tr>
	<tr>
		<td>Hillel (UA-школа, ICP)</td>
		<td>Multi-track школа (програмування, QA, PM/BA, дизайн, маркетинг, англ., діти 12-17); 3-тижневе 100% refund-вікно; LiqPay/plata by mono</td>
		<td>ithillel.ua/courses (верифіковано)</td>
		<td>[hillel-courses](proofs/empirical/hillel-courses/notes.md)</td>
	</tr>
</table>

#### Точність ML-моделей дропауту і ефективність AI tutoring

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Метрика</td>
		<td>Цифра</td>
		<td>Primary source</td>
		<td>Proof</td>
	</tr>
	<tr>
		<td>OULAD benchmark (наш dataset)</td>
		<td>2024 SLR існування + PRISMA + 17 articles (2017–2024) verified. **XGBoost F1 = 0.92 / AUC = 0.97** — paraphrased з web-search summaries; full numbers за Springer paywall</td>
		<td>**Springer 2024 SLR** (Predictive Modelling with OULAD) — [link](https://link.springer.com/chapter/10.1007/978-3-031-64315-6_46)</td>
		<td>[oulad-benchmark-2024](proofs/empirical/oulad-benchmark-2024/notes.md) ⚠️ partial (paywall)</td>
	</tr>
	<tr>
		<td>MAIC dropout LLM-multi-agent (direct prior art)</td>
		<td>**CPADP framework**: PLM+MLP fine-tune → **95.4% acc / F1=0.935** (verbatim verified); GPT-4 few-shot baseline **77.9% / F1=0.604** (verbatim); **+78.6% re-logins (14→25)** — методологічно слабкий (n=17, 6 days, no control) — verbatim verified</td>
		<td>**arxiv 2508.17310** (Aug 2025), Tsinghua/MAIC group — [link](https://arxiv.org/abs/2508.17310)</td>
		<td>[maic-dropout-2025](proofs/empirical/maic-dropout-2025/notes.md) ✅</td>
	</tr>
	<tr>
		<td>Moodle CatBoost (2025)</td>
		<td>CatBoost на student activity logs — state-of-the-art tree boosting для tabular dropout prediction</td>
		<td>**Nature Sci Reports 2025** — [link](https://www.nature.com/articles/s41598-025-93918-1)</td>
		<td>inline citation (proof TBD)</td>
	</tr>
	<tr>
		<td>AUC churn-моделі (production)</td>
		<td>**87.33% AUC**; post-hoc 90.20% AUC; різниця 2.87 п.п.</td>
		<td>**Whitehill et al. 2017** (arxiv 1702.06404), 40 HarvardX MOOCs × 8 тижнів</td>
		<td>[whitehill-mooc-dropout](proofs/empirical/whitehill-mooc-dropout/notes.md)</td>
	</tr>
	<tr>
		<td>Modern tutoring meta (2020/2024) — наш baseline</td>
		<td>**Pooled ES 0.37σ** (verbatim verified в NBER abstract). "96 RCT/quasi-experimental studies" та "none replicate Bloom 2σ" — інтерпретативно з повного paper, не verbatim в abstract</td>
		<td>**Nickow, Oreopoulos & Quan 2020** (NBER w27476); **2024 published in AERJ** — [NBER](https://www.nber.org/papers/w27476), [AERJ](https://journals.sagepub.com/doi/10.3102/00028312231208687)</td>
		<td>[nickow-tutoring-meta](proofs/empirical/nickow-tutoring-meta/notes.md) ✅</td>
	</tr>
	<tr>
		<td>Bloom 2-sigma problem (історичний, **оспорений**)</td>
		<td>1-on-1 tutoring → effect size **2.0σ** (98-й перцентиль) — original Bloom 1984. **Caveat**: 2σ частково артефакт mastery-threshold дизайну (90% bar для tutees, нічого для control) — див. [Education Next](https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/), [Nintil systematic review](https://nintil.com/bloom-sigma/)</td>
		<td>**Bloom 1984** (Educational Researcher, peer-reviewed)</td>
		<td>[bloom-2-sigma](proofs/empirical/bloom-2-sigma/notes.md)</td>
	</tr>
	<tr>
		<td>AI tutoring meta-analysis (modern ITS)</td>
		<td>Median ES **0.66** (50→75 перцентиль), перемога у 46/50 порівнянь (92%); ITS на локальних тестах ES 0.73 vs **0.13 standardized**; VanLehn 2011 — human tutors 0.79σ, step-based ITS 0.75σ, answer-based ITS 0.31σ; K-12 evidence weak (3 школи)</td>
		<td>**Kulik & Fletcher 2016** meta-analysis 50 досліджень; **VanLehn 2011**</td>
		<td>[intelligent-tutoring-wiki](proofs/empirical/intelligent-tutoring-wiki/notes.md)</td>
	</tr>
</table>

#### Метрики й моделювання retention

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Концепт</td>
		<td>Визначення</td>
		<td>Source</td>
		<td>Proof</td>
	</tr>
	<tr>
		<td>Стандартні метрики churn-моделі</td>
		<td>Area Under ROC + Top Decile Lift; подвійна ціль — performance + interpretability</td>
		<td>De Caigny, Coussement, De Bock 2018, EJOR (через Wikipedia)</td>
		<td>[customer-attrition-wiki](proofs/empirical/customer-attrition-wiki/notes.md)</td>
	</tr>
	<tr>
		<td>Uplift segments (4 групи)</td>
		<td>Persuadables / Sure Things / Lost Causes / Sleeping Dogs — лише Persuadables дають incremental ROI</td>
		<td>Lo 2002; Radcliffe 2007; через Wikipedia: Uplift Modelling</td>
		<td>[uplift-modeling-wiki](proofs/empirical/uplift-modeling-wiki/notes.md)</td>
	</tr>
	<tr>
		<td>Формула churn rate</td>
		<td>`churned / customers_at_start × 100` за період</td>
		<td>Wikipedia: Churn rate</td>
		<td>[churn-rate-wiki](proofs/empirical/churn-rate-wiki/notes.md)</td>
	</tr>
</table>

#### Ринок онлайн-освіти

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Показник</td>
		<td>Цифра</td>
		<td>Source</td>
		<td>Proof</td>
	</tr>
	<tr>
		<td>Coursera</td>
		<td>168M юзерів (2024), $694.7M revenue, **net loss $79M**</td>
		<td>Wikipedia: Coursera</td>
		<td>[coursera-wiki](proofs/empirical/coursera-wiki/notes.md)</td>
	</tr>
	<tr>
		<td>edX</td>
		<td>83M юзерів (2023); 2U Chapter 11 у липні 2024</td>
		<td>Wikipedia: edX</td>
		<td>[edx-wiki](proofs/empirical/edx-wiki/notes.md)</td>
	</tr>
	<tr>
		<td>Online learning США</td>
		<td>**7.5M онлайн-студентів** (2024); 53%+ постграду беруть онлайн-курси</td>
		<td>Wikipedia: Cyber school</td>
		<td>[k12-online-wiki](proofs/empirical/k12-online-wiki/notes.md)</td>
	</tr>
</table>

### 15.2 Pricing цифри (SaaS-вендори)

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Сервіс</td>
		<td>Перевірена цифра (2026-05-09)</td>
		<td>Verdict</td>
		<td>Proof</td>
	</tr>
	<tr>
		<td>Claude API (Sonnet)</td>
		<td>$3/M in, $15/M out</td>
		<td>✅ confirmed</td>
		<td>[claude-pricing](proofs/claude-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Claude API (Opus)</td>
		<td>$5/$25 (Opus 4.5+) або $15/$75 (4/4.1)</td>
		<td>✅ confirmed</td>
		<td>[claude-pricing](proofs/claude-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Claude API (Haiku)</td>
		<td>$1/$5 (Haiku 4.5) або $0.80/$4 (Haiku 3.5)</td>
		<td>✅ confirmed</td>
		<td>[claude-pricing](proofs/claude-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Pinecone</td>
		<td>Starter free; Builder $20/міс; Standard $50/міс мін.; Enterprise $500/міс мін.</td>
		<td>✅ confirmed</td>
		<td>[pinecone-pricing](proofs/pinecone-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Auth0</td>
		<td>Free **25,000 MAU**; платні плани через MAU-слайдер</td>
		<td>✅ confirmed</td>
		<td>[auth0-pricing](proofs/auth0-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Clerk</td>
		<td>Hobby free **50,000 MRUs**; Pro $25/міс ($20 yearly); $0.02/MRU (50k–100k); Business $300/міс</td>
		<td>✅ confirmed</td>
		<td>[clerk-pricing](proofs/clerk-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Sentry</td>
		<td>Developer free; Team $26/міс; Business $80/міс</td>
		<td>✅ confirmed</td>
		<td>[sentry-pricing](proofs/sentry-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Metabase</td>
		<td>OSS AGPL self-host $0; Cloud Starter $100/міс + $6/user; Pro $575/міс + $12/user; Enterprise $20k/рік</td>
		<td>✅ confirmed</td>
		<td>[metabase-pricing](proofs/metabase-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Tableau</td>
		<td>Standard $15/user/міс; Enterprise $35/user/міс (billed annually)</td>
		<td>✅ confirmed</td>
		<td>[tableau-pricing](proofs/tableau-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Power BI</td>
		<td>Pro $14/user/міс; Premium Per User $24/user/міс (paid yearly)</td>
		<td>✅ confirmed</td>
		<td>[powerbi-pricing](proofs/powerbi-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>MongoDB Atlas</td>
		<td>Free (M0) $0 forever; Flex $0.011/год до $30/міс; Dedicated від $56.94/міс</td>
		<td>✅ confirmed</td>
		<td>[mongodb-atlas-pricing](proofs/mongodb-atlas-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>AG Grid</td>
		<td>Community free (MIT); Enterprise $999/dev; Bundle $1,498/dev</td>
		<td>✅ confirmed</td>
		<td>[ag-grid-pricing](proofs/ag-grid-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Highcharts</td>
		<td>Non-commercial CC BY-NC безкоштовно; Annual від $185/seat; Perpetual від $366/seat</td>
		<td>✅ confirmed</td>
		<td>[highcharts-pricing](proofs/highcharts-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Drata</td>
		<td>Pricing непублічний (Cloudflare-захищений "Contact sales")</td>
		<td>✅ confirmed (як non-public)</td>
		<td>[drata-pricing](proofs/drata-pricing/notes.md)</td>
	</tr>
	<tr>
		<td>Gainsight (analog для нашого SaaS pricing)</td>
		<td>Тільки 2 tiers (Essentials, Enterprise), обидва "Contact Sales"; ринкові оцінки з G2: Essentials ~$1k/міс, Enterprise $20–60k/рік</td>
		<td>✅ confirmed (як non-public)</td>
		<td>[gainsight-pricing](proofs/empirical/gainsight-pricing/notes.md)</td>
	</tr>
</table>

### 15.3 Competitive landscape & industry signals (нові sources, додані 2026-05-09)

<table fit-page-width="true" header-row="true">
	<tr>
		<td>Showcase</td>
		<td>Цифра / claim</td>
		<td>Primary source</td>
		<td>Proof</td>
	</tr>
	<tr>
		<td>EdTech B2B SaaS churn</td>
		<td>**9.6% monthly** — найвищий серед всіх вертикалей (verbatim verified); doubled since 2024</td>
		<td>[Artisan Strategies — 2026 SaaS Churn Benchmarks](https://www.artisangrowthstrategies.com/blog/saas-churn-rate-benchmarks-2026-500-companies)</td>
		<td>[edtech-saas-churn-2026](proofs/empirical/edtech-saas-churn-2026/notes.md) ✅</td>
	</tr>
	<tr>
		<td>EdSights (closest direct competitor)</td>
		<td>**250+ universities** (live site, 2026-05-09 — раніше публікувалось 140+); +7% retention avg; 62% engagement; 100+ languages. **Pricing $5–$15/student** з 2020 AlleyWatch profile (не на live site)</td>
		<td>[edsights.com](https://www.edsights.com/); [AlleyWatch 2020 — pricing reference](https://www.alleywatch.com/2020/02/edsights-chatbot-college-dropout-retention-claudia-carolina-recchi/)</td>
		<td>[edsights](proofs/empirical/edsights/notes.md) ⚠️ partial (pricing not on live site)</td>
	</tr>
	<tr>
		<td>Civitas Learning + Starfish</td>
		<td>Student Impact Platform; "individualized, proactive student support through centralized data, real-time insights, and coordinated workflows" (verbatim)</td>
		<td>[civitaslearning.com/platform](https://www.civitaslearning.com/platform/)</td>
		<td>[civitas-starfish](proofs/empirical/civitas-starfish/notes.md) ✅</td>
	</tr>
	<tr>
		<td>Online HE dropout systematic review 2024</td>
		<td>110 articles; 5 pillars предикторів (demographic / course / technology / motivational / support — verbatim verified). Specific log-features (days-since-last-access etc.) — у supplementary Table S4, не у HTML</td>
		<td>[Springer 2024 — Int J Educ Tech HE](https://educationaltechnologyjournal.springeropen.com/articles/10.1186/s41239-024-00450-9)</td>
		<td>[online-he-dropout-slr-2024](proofs/empirical/online-he-dropout-slr-2024/notes.md) ✅</td>
	</tr>
	<tr>
		<td>n8n multi-agent limitations</td>
		<td>Coordination overhead, quality drift, token explosion, security failure modes (verbatim verified). **Caveat**: "5–7 tools sweet spot" — з [Anthropic engineering docs](https://www.anthropic.com/engineering), не з n8n блогу. "Duplicate charges / corrupted records" — паразрафовано з MindStudio</td>
		<td>[n8n blog — Multi-agent systems](https://blog.n8n.io/multi-agent-systems/); [MindStudio — n8n vs agentic workflows](https://www.mindstudio.ai/blog/n8n-vs-agentic-workflows-when-to-use-each)</td>
		<td>[n8n-multi-agent-limits](proofs/empirical/n8n-multi-agent-limits/notes.md) ⚠️ partial</td>
	</tr>
	<tr>
		<td>Khanmigo (caveat для AI-tutor narrative)</td>
		<td>**6.1 percentage-point improvement** on next-item correctness (verbatim verified). Quote "for many students it was a non-event" — paraphrased through K991 news report, not in primary Khan Academy source</td>
		<td>[Khan Academy blog 2025](https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/)</td>
		<td>[khanmigo-modest-effects](proofs/empirical/khanmigo-modest-effects/notes.md) ⚠️ partial (6.1pp confirmed, "non-event" quote second-hand)</td>
	</tr>
	<tr>
		<td>Uplift modelling for student dropout (RCT example)</td>
		<td>Persuadable-targeting перевершує propensity-targeting на student data; вимагає RCT-randomized treatment assignment</td>
		<td>[Sciencedirect — Uplift Modeling for preventing student dropout](https://www.sciencedirect.com/science/article/pii/S0167923620300750)</td>
		<td>inline citation (proof TBD — Sciencedirect Cloudflare-blocked)</td>
	</tr>
</table>

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

- **Churn** — відтік учнів (не продовжили підписку, не закінчили курс).
- **Completion rate** — % учнів, які завершили курс / отримали сертифікат від загальної кількості enrolled. Зворотна до dropout rate.
- **Dropout / Drop-off** — % учнів, які покинули курс до завершення.
- **Retention** — утримання учнів. Зворотна метрика churn.
- **MAU / DAU / WAU** — Monthly / Daily / Weekly Active Users.
- **MRR / ARR** — Monthly / Annual Recurring Revenue — повторюваний дохід з підписок.
- **CLV (Customer Lifetime Value)** — сумарний прибуток від клієнта.
- **ROI (Return on Investment)** — `(profit − cost) / cost × 100%`.
- **KPI (Key Performance Indicator)** — головний показник ефективності.
- **ICP (Ideal Customer Profile)** — портрет ідеального клієнта.

### ML / AI / Data Science

- **ML (Machine Learning)** — алгоритми, що знаходять патерни у даних.
- **LLM (Large Language Model)** — Claude, GPT, Gemini, Llama. Передбачає наступне слово на основі контексту.
- **Multi-agent system** — архітектура з кількох спеціалізованих AI-агентів, що співпрацюють. У нас: Спостерігач + Аналітик + Стратег + Комунікатор.
- **n8n** — open-source workflow automation tool (low-code), що ми використовуємо для оркестрації агентів. Аналог Zapier/Make, але self-hosted і вільніший.
- **Orchestrator / Planner agent** — головний агент, що приймає вхідні події, розподіляє між підлеглими агентами, агрегує результат.
- **NLP (Natural Language Processing)** — обробка природної мови.
- **RAG (Retrieval-Augmented Generation)** — спершу шукаємо контекст у БД, потім додаємо у промпт LLM.
- **Embeddings** — числові вектори, що представляють смисл тексту.
- **Vector DB / pgvector** — БД для embeddings + пошук найближчих сусідів.
- **Tokens / MTok** — одиниці тексту, якими LLM його "бачить" (~0.75 слова кожен). MTok = 1 мільйон.
- **Prompt caching** — повторне використання вже опрацьованої частини контексту. Знижує вартість input tokens у 5–10 разів.
- **Structured outputs** — форсування LLM повертати JSON за схемою.
- **Галюцинація** — впевнено сформульована хибна відповідь LLM.
- **Eval / LLM-as-judge** — автоматична оцінка якості відповідей LLM.
- **Feature attribution** — який вклад кожна фіча зробила у конкретне передбачення.
- **SHAP (SHapley Additive exPlanations)** — стандартний метод feature attribution.
- **XGBoost / LightGBM / CatBoost** — gradient boosting на деревах, baseline для табличного ML.
- **Survival analysis (Kaplan-Meier, Cox)** — статистичні моделі для "коли подія настане".
- **Uplift modeling** — моделює, як інтервенція X змінить поведінку юзера Y. Розрізняє Persuadables, Sure Things, Lost Causes, Sleeping Dogs.
- **Causal inference** — методи виявлення причинно-наслідкового зв'язку.
- **AUC (Area Under ROC Curve)** — метрика бінарного класифікатора. 0.5 = випадковий, 1.0 = ідеальний.
- **ROC** — крива trade-off між true positive і false positive rate.
- **F1 score** — гармонійне середнє precision та recall.
- **Top Decile Lift** — наскільки топ-10% за score дають реальних churners порівняно з base rate.
- **Imbalanced classes** — один клас значно рідший за інший.
- **Cold start** — модель не може давати точні передбачення для нового клієнта без історичних даних.
- **Transfer learning** — тренування моделі на одних даних, застосування на нових.
- **Heuristic baseline** — система правил замість ML.
- **RCT (Randomized Controlled Trial)** — рандомізований експеримент з контрольною і treatment-групою.
- **A/B test** — практичний RCT у продакшні.

### Інфраструктура

- **API (Application Programming Interface)** — інтерфейс для програмного спілкування.
- **Webhook** — HTTP-запит, який зовнішня система надсилає нам при події.
- **Event store** — БД-таблиця для історії подій.
- **Idempotency** — повторне виконання дає той самий результат.
- **DLQ (Dead Letter Queue)** — черга для повідомлень, які не вдалось обробити.
- **Multi-tenant** — одна інстанція обслуговує багато клієнтів, кожен бачить тільки свої дані.
- **Row-Level Security (RLS)** — Postgres-фільтрація рядків залежно від поточного юзера.
- **CI/CD** — автоматичні тести + деплой при кожному коміті.
- **Self-hosted** — софт на власній інфраструктурі.
- **vLLM** — open-source inference engine для self-hosted LLM.

### EdTech

- **LMS (Learning Management System)** — Thinkific, Teachable, Kajabi, Moodle, GoIT custom platform.
- **MOOC (Massive Open Online Course)** — масовий відкритий онлайн-курс.
- **SCORM / xAPI** — стандарти LMS-івентів.
- **xAPI (Experience API)** — формат `Actor-Verb-Object`.

### Бізнес-сегментація

- **SaaS (Software as a Service)** — софт через підписку.
- **B2B / B2C** — Business-to-Business / Business-to-Consumer.
- **SMB / Enterprise** — Small/Medium Business vs Enterprise.

### Compliance

- **GDPR** — закон ЄС про захист персональних даних.
- **FERPA** — закон США про захист освітніх записів учнів.
- **COPPA** — закон США про захист даних дітей до 13 років.
- **SOC 2 Type II** — аудит безпеки організації.
- **DPA (Data Processing Agreement)** — обов'язковий договір під GDPR.

---

**Дата створення документа**: 2026-05-09
**Останнє оновлення**: 2026-05-09 (повне перебудування під узгодження команди в Telegram-чаті 8–9 травня 2026)
**Команда**: Arsenii (FE+BE+AI), Дмитро + Микола (AI agents + n8n), Олексій + Маргарита (data), Гюльзар (UX), Еріка (content+presentation), Nadin (tech lead + BA)
**Дедлайн хакатона**: 18 травня 2026
