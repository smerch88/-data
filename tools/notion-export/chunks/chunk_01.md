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