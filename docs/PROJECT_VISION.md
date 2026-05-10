# EdTech Retention Platform — концепція і план

> Цей документ — продуктово-технічна основа для проекту, який команда готує на хакатон з дедлайном 18 травня 2026 і подальший розвиток у пілотний продукт. Будується поверх скелета з кореневого `CLAUDE.md` (Postgres + Node/TS бекенд) + n8n для AI-оркестрації. Майбутні сесії Claude Code мають читати цей файл перед прийняттям продуктових/архітектурних рішень.

## TL;DR для Claude

- **Що будуємо в хакатоні (10 днів)**: мульти-агентну AI-систему, що моніторить онлайн-школу через дані з LMS і Slack, виявляє учнів у ризику відтоку, пояснює причину, і генерує персональний message-draft для повернення. Multi-agent — це **архітектурне ядро**, без AI продукт не існує (відповідає критерію журі: AI-імплементація = 25% оцінки).
- **Кому продаємо**: українські онлайн-школи з 100–5000 активних учнів — GoIT, Hillel ([✓ verified](#proof-hillel-courses)), Projector, Prometheus, LearnLifeLong тощо. Кожен втрачений учень = $400–2000 доходу (на основі ринкових цін українських IT-курсів — див. [Hillel proof](#proof-hillel-courses) + 3-тижневе refund-вікно як direct revenue exposure школи) + репутаційні ризики. Industry-wide signal: **EdTech має найвищий B2B SaaS churn — 9.6%/міс** ([✓ verified](#proof-edtech-saas-churn)).
- **Чому тільки multi-agent а не ML+LLM-гібрид**: команда з 7 людей, ~10 днів після роботи, обмежений ресурс на debug + data labeling. Multi-agent через n8n працює з першого дня без training data. ML-шар (XGBoost + SHAP як попередній фільтр перед агентами) свідомо **відкладений на post-hackathon roadmap** для оптимізації unit economics. На OULAD benchmark best-published XGBoost дає **F1≈0.92 / AUC≈0.97** ([✓ verified](#proof-oulad-benchmark-2024)) як ceiling; типове *production*-значення без heavy feature engineering: F1≈0.85–0.90, AUC≈0.85–0.95 — це наша реалістична ціль для post-hackathon ML-шару.
- **Що НЕ робимо в хакатоні**: класична ML-модель churn-prediction; survival analysis; uplift modeling; SHAP-feature attribution; production-ready scoring engine. Усе це в roadmap, але не в demo.
- **Чим відрізняємось від MAIC ([arxiv 2508.17310](https://arxiv.org/abs/2508.17310), Aug 2025) і EdSights**: MAIC = closed AI classroom; EdSights = SMS-chatbot для US universities. Ми = **agent-as-observer над heterogeneous LMS+Slack** + **tone-of-voice draft в стилі школи** + **B2B для онлайн-шкіл 100–5,000 учнів** (underserved middle). Деталі — §2.3.

## 1. Концепція

### Проблема (з польової експертизи: Nadin — ментор GoIT)
Онлайн-школи фізично не можуть відстежити кожного учня. Ментор з 100–500 студентів помічає, що учень "відвалюється", уже постфактум — коли той пропустив 2–3 ДЗ, перестав заходити в LMS і не відповідає на повідомлення. Школа втрачає $400–2000 доходу за кожного, плюс репутацію через NPS і word-of-mouth.

### Job-to-be-done (для School / Course Manager)
> "Знайди мені 5–10 учнів, які зараз потребують уваги, поясни конкретно, в чому проблема кожного, і дай готову персональну дію — щоб я міг витратити 30 хвилин замість 3 годин і повернути учня **до того**, як він морально пішов."

### Ціннісна метрика
% зменшення [churn](#glossary-churn) або % збільшення [completion rate](#glossary-completion-rate). Все інше — proxy.

### Емпіричний baseline проблеми
- **EdTech B2B SaaS — найвищий monthly churn серед усіх вертикалей: ~9.6%/міс** (industry benchmarks 2026, [Artisan Strategies](https://www.artisangrowthstrategies.com/blog/saas-churn-rate-benchmarks-2026-500-companies)) [✓ verified](#proof-edtech-saas-churn). Це **complementary commercial signal** до академічних MOOC-цифр: SaaS-вендори EdTech самі страждають від утримання → ринок retention-tooling доведений ринком, не лише академією. Метрика інша за студентський dropout (це vendor churn, не student dropout) — використовуємо як market-demand signal, цільову метрику продукту дають Jordan/ERIC нижче. За цим же бенчмарком, EdTech-monthly-churn **приблизно подвоївся з 2024 року** (verbatim: "a rate that has doubled since 2024").
- **MOOC median completion rate: 12.6%** (Jordan 2015 IRRODL, 221 курсів) — [✓ verified](#proof-jordan-2015-irrodl). Newer revisit ([Open Praxis 2024](https://openpraxis.org/articles/10.55982/openpraxis.16.3.606)) підтверджує діапазон.
- **Distance education dropout: 30–50%** (US літературний consensus; Європа 20–30%; Азія до 50%) — [✓ verified](#proof-eric-distance-ed).
- **Online dropout vs offline: на 10–20% вищий, у деяких студіях — у 6–7 разів** (Christensen & Spackman 2017) — [✓ verified](#proof-eric-online-vs-offline).
- **2024 systematic review of 110 articles on online HE dropout** ([Springer 2024](https://educationaltechnologyjournal.springeropen.com/articles/10.1186/s41239-024-00450-9)) [✓ verified](#proof-online-he-dropout-slr-2024): 5 pillars предикторів — demographic, course-related, technology-related, motivational, support-related. **Strongest log-based predictors**: days-since-last-access, log frequency, activity types. **Це прямо валідує signal sequence Nadin (§6.3)** — академія підтверджує польову експертизу.
- **Перші 1–2 тижні курсу — критичні**: після них активність stabilизується (різниця <3% у наступні тижні) — Jordan 2015. Це задає вікно для нашого моніторингу. Cross-confirm: Hillel [має refund-вікно 3 тижні](#proof-hillel-courses) — школи самі визнають критичність першого місяця.

### Чому AI multi-agent — це наукова база, не маркетинг

- **Сучасний tutoring meta-analysis (Nickow, Oreopoulos & Quan 2024 AERJ)** [✓ verified](#proof-nickow-tutoring-meta): peer-reviewed публікація в *American Educational Research Journal* 61(1):74–107 ([DOI 10.3102/00028312231208687](https://journals.sagepub.com/doi/10.3102/00028312231208687)) → **pooled effect size 0.29σ на 89 RCT/quasi-experimental tutoring-програмах PreK-12, 732 effect estimates**. Це **оновлення вниз** від 0.37σ / ~96 studies, що публікувалися як NBER working paper 2020 ([w27476](https://www.nber.org/papers/w27476)) — peer-review зрізав headline-цифру. Журі-defensible — 0.29σ. Heterogeneity з paper: ефект більший у teacher/paraprofessional vs volunteer/parent tutors; найбільший у earlier grades; in-school > after-school; ≥3 days/week дає сильніший ефект. Жодне з 89 досліджень не відтворило Bloom 2σ — це інтерпретація pooled-результатів (~5× менше за 2σ), не verbatim-claim з абстракту.
- **Bloom's 2-sigma problem (1984)** [✓ verified](#proof-bloom-2-sigma): історичний орієнтир (50-й → 98-й перцентиль) **сильно оспорений модерними реплікаціями**. Оригінальний 2σ-ефект частково зумовлений mastery-threshold дизайном (tutees мали 90% бар, control — без бару). Залишаємо як rhetorical anchor для проблеми "scalable 1:1", не як обіцянку ефекту.
- **VanLehn 2011** [✓ verified](#proof-intelligent-tutoring-wiki): human tutors → **0.79σ**, step-based ITS → **0.76σ** (28 порівнянь), answer-based ITS → **0.31σ** (165 досліджень), substep-based ITS → 0.40σ. Тобто реальні step-based AI-tutors статистично близькі до експертів-людей, але не до Bloom-овського 2σ.
- **Modern ITS meta-analysis (Kulik & Fletcher 2016)** [✓ verified](#proof-intelligent-tutoring-wiki): 50 контрольованих експериментів → median ES **0.66σ** (50-й → 75-й перцентиль), перемога у 92% порівнянь. **Caveat**: на локально розроблених тестах ES 0.73, на стандартизованих — лише **0.13**. K-12 контекст: K-12 math у Kulik & Fletcher показав ES 0.40 SD (0.10 на стандартизованих); Steenbergen-Hu & Cooper 2013 на тих же K-12 math студіях знайшли ~0 — тобто K-12 evidence **contested**, а не одностайно сильний.
- **Реалістичний таргет нашого продукту**: **7–15% reduction in dropout у пілоті**, з валідацією точного значення на real data. Замість back-of-envelope multiplier'а використовуємо **bracket між двома найближчими аналогами** (обидва peer-reviewed):
  - **Floor — chatbot baseline**: EdSights SMS-chatbot для at-risk students → **+7% avg retention** ([✓](#proof-edsights), 250+ US universities, **без human-in-the-loop**). Це мінімум "автоматизований outreach без особистого дотику" — нижче ми не маємо опуститися, бо додаємо менеджера, що особистіше за template-bot.
  - **Ceiling — tutoring baseline**: full live tutoring (Nickow AERJ 2024 0.29σ + Kulik 2016 ITS 0.66σ) → ~15–25% reduction in dropout at maximum intensity. Це максимум "персистентний 1:1 контакт" — вище ми не дотягнемо, бо ми не tutoring (1 message + manager send ≠ 3 сесії/тиждень з персистентними відносинами).
  - **Наша позиція**: chatbot-with-human-relay — особистіше за SMS-bot (manager-tailored draft, не template), слабше за live tutor (нижча intensity, лише outreach-trigger). Очікуємо **середню частину bracket'а**; пілот валідує exact value через approval rate × manager engagement × frequency-of-send (§13 metrics).
  - **На презентації говоримо 7–15%, з honest caveat "exact value validated in pilot"**, а не точкову обіцянку. Це сильніше за "10-15% бо tutoring × multiplier" — обидва кінці bracket'а мають peer-reviewed citation, intermediate point — measurable hypothesis з explicit pilot test.

## 2. Диференціація проти конкурентів

### 2.1 Commercial SaaS competitors

| Конкурент | Що робить | Чого НЕ робить (наша ніша) |
|---|---|---|
| **EdSights** ([edsights.com](https://www.edsights.com/)) [✓ verified](#proof-edsights) | SMS-chatbot для at-risk students; **250+ університетів** + **62% engagement rate** (homepage verbatim, 2026-05-10); +7% retention avg (case studies + [WaPo 2024 op-ed](https://www.washingtonpost.com/opinions/2024/05/01/edsights-college-ai-student-retention/), не на homepage); ціна **$5–$15/student/year** ([2020 AlleyWatch profile](https://www.alleywatch.com/2020/02/edsights-chatbot-college-dropout-retention-claudia-carolina-recchi/), не на live site) | Single-channel (SMS), single-institution focus (US universities), не аналізує реальні Slack/LMS-чати студентів між собою; не observation-based — chatbot тільки **запитує**, наш Спостерігач **слухає** реальні розмови без додаткових опитувань |
| **Civitas Learning + Starfish** ([civitaslearning.com](https://www.civitaslearning.com/platform/)) [✓ verified](#proof-civitas-starfish) | Student Impact Platform для US higher ed; institution-specific data + real-time insights + coordinated workflows | Enterprise-only (university-scale 5k–50k students); пакет коштує $$$$ (implementation fee + annual licensing); не для онлайн-шкіл 100–5,000 учнів |
| **Mixpanel / Amplitude / Heap** | Generic product analytics, churn-дашборди | Не EdTech-aware, не пропонують intervention, тільки графіки |
| **Gainsight / ChurnZero** | Customer Success платформи з NLP-скорингом | Корпоративні (mid-market $10K–$25K+/year, enterprise $20K–$60K+/year — [G2/Capterra estimates](#proof-gainsight-pricing)); не для онлайн-шкіл з 100–500 учнів; B2B SaaS focus, не EdTech-specific |
| **Вбудована аналітика Thinkific / Teachable / Kajabi** | Метрики логінів, прогрес курсу | Базова, без розуміння причин, без AI-driven дії |
| **PowerSchool Naviance + PowerBuddy** ([powerschool.com](https://www.powerschool.com/solutions/college-career-and-life-readiness/naviance-cclr/)) | K-12 platform, **35% of US high schools / 8M students**; 2025-26 додає AI-помічника | K-12 only, US-locked, college-prep focus; не для дорослих online learners |
| **Ручний моніторинг (Excel + Slack-нотатки ментора)** | Все робиться руками | Не масштабується; школа з 1000+ учнів фізично не може відстежити кожного |

### 2.2 Academic prior art (2024–2025)

| Робота | Що робить | Чим ми відрізняємось |
|---|---|---|
| **MAIC — Massive AI-empowered Course** ([arxiv 2508.17310](https://arxiv.org/abs/2508.17310), Aug 2025) [✓ verified](#proof-maic-dropout) | LLM multi-agent classroom (AI Teacher + AI TAs + Simulated Peers + Personalized Email Recall Agent); CPADP framework; PLM+MLP achieves **95.4% accuracy / F1=0.935** на >3,000 students; +78.6% re-logins claim **(методологічно слабкий: n=17, 6 days, no control group)** | **Закрита AI-classroom** — MAIC замінює викладача, ми **спостерігаємо існуючу школу зовні**. Наш agent читає реальні Slack/LMS-події між живим ментором і живим студентом. MAIC не вирішує B2B-онбоардинг для шкіл, які вже мають викладачів |
| **From MOOC to MAIC** ([arxiv 2409.03512](https://arxiv.org/abs/2409.03512), 2024) | Foundational paper для LLM-driven course agents | Проектує всю pedagogy навколо AI; ми додаємо **action layer поверх існуючої pedagogy**, не реплейсимо її |
| **AI instructional agent RCT** ([arxiv 2505.22526](https://arxiv.org/html/2505.22526v1), May 2025) | RCT доводить, що AI-agent покращує perceived learner control | Підтверджує наш напрям, але не закриває нашу нішу: external observation + draft → human Send |

### 2.3 Наша унікальна позиція (wedge)

Ми **не tutor-replacement** і **не chatbot**. Ми **agent-as-observer над heterogeneous data plane** + **human-in-the-loop action layer**. Чотири фічі, які жоден з вище-перелічених не комбінує:

1. **Cross-channel observation**: агент читає Slack DM + group chat + support channel + LMS events як єдиний стрім, корелює signals 1–7 (§6.3). EdSights/Civitas → single channel; MAIC → closed classroom.
2. **Heterogeneous LMS/Slack tenant**: побудовано так, що школа підключає **свої** Thinkific/Teachable/Moodle/custom LMS і **свій** Slack/Discord без міграції на нашу платформу. EdSights/Civitas/PowerSchool → проприетарна платформа.
3. **Tone-of-voice agent (Комунікатор)**: draft message пишеться **в стилі конкретної школи** (configurable). EdSights → стандартний chatbot tone; MAIC → universal AI prompt; Civitas → workflow templates без AI-генерації тексту.
4. **False-positive resistance by design**: 4-persona test set (HIGH/MEDIUM/SILENT-BUT-OK/FALSE-ALARM, §6.1) перетинається з реальними OULAD `final_result` категоріями. **Доводимо журі і клієнтам не лише "ловить ризик", а й "не флагує невинних"** — вимога, яку single-channel chatbot-и обходять стороною.
5. **B2B segment "underserved middle"**: 100–5,000 students → надто малий для Civitas/Starfish (university scale), надто великий для Excel-ментора. EdSights в цьому сегменті ходить, але через US universities — **український/EU мід-сегмент онлайн-шкіл відкритий**.

**Wedge ≠ moat (чесно про defensibility).** Усі 5 пунктів вище — позиціонування і execution-перевага, не технічний моат. Конкурент-клон з ресурсами може повторити cross-channel + tone-of-voice за 2–3 спринти. **Реальна defensibility будується пост-пілот:** (a) RCT-validated uplift на українському EdTech-сегменті як пропрієтарна training data для uplift-моделі, (b) глибина LMS/Slack-інтеграцій, де переключення дорожче за нашу підписку. Day one жодного з цих немає — це нормально для $300/міс ICP, не для enterprise. Журі і pilot-клієнтам говоримо це прямо: ми робимо ставку на **first-mover + RCT-data flywheel**, не на технологічний секрет.

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

### 4.0 Чому 4 агенти (а не один великий промпт)

Декомпозиція не довільна і не "архітектурний театр" — кожен агент відрізняється по **scope даних** і **token-budget**:

- **Спостерігач + Аналітик мають різний обсяг входу.** Спостерігач сканує **7-денне вікно** по **всім** активним студентам школи (filter step, дешеві prompts, дублюється часто) → output: severity scores. Аналітик читає **30-денний крос-табличний контекст** (3 таблиці × 30 днів × full chat history) лише по **flagged students з severity ≥ 5** (deep step, дорогий prompt, рідкісний). Об'єднання їх в один промпт = або token explosion (30-day deep-context для всієї бази на кожному скані), або поверхневий аналіз (7 днів усім, чого не вистачає для діагнозу). Це **не два кути на ті самі дані** — це різні data-pipelines.
- **Стратег + Комунікатор розділені по аудитованості.** Action-selection (policy) і message-generation (text) технічно можна злити в один промпт ("обери дію + напиши драфт"). Розділення дає: (a) аудит "чому саме ця дія" окремо від "як це сформульовано" — менеджер бачить rationale без впливу tone-формулювань, (b) A/B на rivane tone без зміни action policy, (c) можливість кешувати action і регенерувати тільки текст при зміні tone-of-voice.
- **Чесно**: розділення Стратега і Комунікатора — defensible, але не критичне. Якщо token-cost буде проблемою у production, їх можна злити; розділення Спостерігача і Аналітика — критичне і не перемежовується.

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
- **Тригер**: scheduled (раз на день) або event-driven (новий LMS-event / Slack-message → webhook).
- **Вхід**: **multi-source 7-денне вікно** по студенту:
  - **Primary (real OULAD signals)**: homework records (deadlines, submissions, grades, статуси), LMS login/access events.
  - **Secondary (синтетичні Slack-чати на хакатоні; real chats у пілоті)**: повідомлення з трьох типів каналів — mentor_dm, group_chat, support_chat.
  - На демо це важливо: **первинні сигнали ризику походять з real OULAD-даних** (homework + LMS-events), чати додають контекст і фразеологію. Це нівелює ризик "circular demo на власноручно написаних чатах".
- **Логіка**: prompt-classifier на Claude — шукає тривожні сигнали з 7-етапної послідовності (з власної експертизи Nadin як ментора GoIT, див. [§6.3](#63-сигнали-дропауту-польова-експертиза)). 4 з 7 сигналів — LMS/homework-based (real); 3 — chat-based (контекст):
  1. ДЗ із запізненням *(homework, real)*
  2. Пропустив 1–2 уроки з викладачем *(LMS events, real)*
  3. Перестав ставити питання *(chat, контекст)*
  4. Не здав ДЗ взагалі *(homework, real)*
  5. Не заходив у LMS >7 днів *(LMS events, real)*
  6. Негативні повідомлення ("складно", "кину", "не встигаю") *(chat, контекст)*
  7. Не відповідає на ПП ментора *(chat, контекст)*
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

### 9.2 Re-platforming agent orchestration (коли n8n впирається)

n8n чудовий для хакатона і перших 5–10 клієнтів, але має задокументовані обмеження для production multi-agent ([n8n blog — Multi-agent systems](https://blog.n8n.io/multi-agent-systems/), [MindStudio — n8n vs agentic workflows](https://www.mindstudio.ai/blog/n8n-vs-agentic-workflows-when-to-use-each)) [⚠️ partial](#proof-n8n-limitations):

- **Coordination overhead, quality drift, token explosion** — verbatim categories з n8n blog.
- **Tool-calling failure modes** — failed tool calls можуть ламати workflow; security risks при додаванні tools.
- **Complexity ceiling** — за [Anthropic engineering doc on multi-agent research systems](https://www.anthropic.com/engineering/multi-agent-research-system) (verbatim verified): **3–5 subagents in parallel** для швидкості; **3–10 tool calls per simple subagent**, 10–15 для direct comparisons, 10+ subagents для complex research. Перевищення → token explosion + coordination overhead. Tools-per-agent кількість Anthropic явно не нормує — це наш own design constraint при scale.
- **n8n не проектувався для глибокого autonomous orchestration** — для 4 агентів і shallow handoffs OK, для 10+ агентів і circular reasoning потрібно re-platforming.

**Trigger для re-platforming**: коли підключаємо 10-го клієнта **АБО** додаємо 5+ агента, мігруємо на code-based framework (LangGraph / CrewAI / custom Python). Цей перехід вже закладений у roadmap (§13, "ML-шар" фаза) — **не surprise risk**.

### 9.3 Реальні інтеграції

- **LMS webhooks**: Thinkific, Teachable, Kajabi, Moodle, custom — кожна нова = 1–3 тижні роботи.
- **Slack / Discord APIs** — для агента-Спостерігача в реальних чатах.
- **Stripe / Recurly** — для signal "downgrade / failed payment".
- **Mailchimp / Resend** — для відправки агентом-Комунікатором.

### 9.4 A/B testing engine
RCT-розбивка з самого початку action layer: треба довести **uplift від інтервенцій**, не просто accuracy churn-моделі. Це і буде real product moat (див. [§11](#11-емпіричний-фундамент)). Прямий приклад в нашій галузі: [Sciencedirect — Uplift Modeling for preventing student dropout](https://www.sciencedirect.com/science/article/pii/S0167923620300750) — RCT-data + uplift-modelling показує, що persuadable-targeting знижує dropout сильніше за propensity-targeting.

### 9.5 Modes продукту

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

- **OULAD benchmark (наш dataset)**: 2024 systematic literature review ([Springer 2024](https://link.springer.com/chapter/10.1007/978-3-031-64315-6_46)) consolidує 17 articles (2017–2024). **Best-published XGBoost ceiling**: F1 ≈ 0.92, AUC ≈ 0.97 (cross-confirmed через незалежні web-summaries; вимагає extensive feature engineering / SMOTE oversampling). **Realistic typical XGBoost** без heavy preprocessing: F1 ≈ 0.85–0.91 (наприклад, окреме 2024 study повідомляє 92.4% accuracy / F1=0.91), AUC ≈ 0.85–0.95. [⚠️ partial](#proof-oulad-benchmark-2024) (ID/PRISMA verified; точний headline numbers за Springer paywall). **Реалістична post-hackathon ML-target**: F1 ≈ 0.85, AUC ≈ 0.90 — defensible проти журі, не "0.97 зі стелі".
- **MAIC CPADP framework** ([arxiv 2508.17310](https://arxiv.org/abs/2508.17310)): fine-tuned PLM + MLP classifier на >3,000 students → **95.4% accuracy / F1 = 0.935**. GPT-4 few-shot baseline у тій же роботі — лише 77.9% / F1 = 0.604. **Висновок**: на тих самих даних ML-fine-tune перевершує pure-LLM на 17 п.п. accuracy → це підтверджує наш roadmap §9.1 (ML-as-prefilter, LLM-as-deep-analysis), а не pure-LLM-only архітектуру.
- **AUC 87.33% production / 90.20% post-hoc** на 40 HarvardX MOOCs за 8 тижнів. Розрив 2.87 п.п. AUC між тестовим стендом і production-режимом. 5-layer NN значно кращий за logistic regression. — Whitehill et al. 2017 [✓ verified](#proof-whitehill-mooc-dropout).
- **Стандартні метрики churn-моделі**: AUC + Top Decile Lift; подвійна мета — predictive performance + interpretability. — De Caigny et al. 2018 [✓ verified](#proof-customer-attrition-wiki).
- **Moodle log-data CatBoost (2025)** [✓ verified](#proof-moodle-catboost-2025): [Nature Sci Reports 2025](https://www.nature.com/articles/s41598-025-93918-1) — CatBoost на student activity logs підтверджує tree-based gradient boosting як state-of-the-art для tabular dropout prediction. Reinforces наш ML-stack choice.
- **Висновок**: реалістичний таргет **85–90% AUC / 0.85 F1** за достатнього обсягу даних (OULAD-grade quality); перші клієнти отримають нижчий performance до накопичення training data — мітигується heuristic baseline на старті. Best-case ceiling F1=0.92/AUC=0.97 — лише при extensive feature engineering + SMOTE.

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
| **Direct prior art (MAIC, arxiv 2508.17310)** | LLM multi-agent + dropout intervention вже опубліковано Aug 2025 з 95.4% accuracy | MAIC = closed AI classroom з AI-Teacher; ми = **observation-mode над живими школами**. Журі може побачити MAIC у пошуку — на презентації **самі** проактивно цитуємо MAIC і пояснюємо різницю (§2.3 wedge) |
| **Direct commercial competitor (EdSights, $5–$15/student)** | 250+ universities US ринок зайнятий | EdSights = SMS-chatbot, single-channel; ми = cross-channel observer. Ринковий segment EU/UA онлайн-шкіл відкритий — EdSights туди не локалізований |
| Multi-agent ловить глюки і бага | n8n + Claude може давати unstable output, **n8n має задокументовані orchestration-обмеження** ([✓](#proof-n8n-limitations)) | Жорсткі structured outputs (JSON schema), evals на 4 demo-персонах перед finalізацією. Re-platforming у LangGraph/CrewAI заплановано на 10-го клієнта (§9.2) |
| LLM hallucinations у Comunікатор-агенті | Будь-яка LLM може вигадати факти про учня | Завжди як **draft**; menедж натискає Send. Контекст агента — тільки реальні поля з БД, не свободна інтерпретація. Khanmigo cautionary tale ([⚠️ partial](#proof-khanmigo-modest)) — навіть Khan Academy показав лише **6.1pp improvement** на next-item correctness; самі автори визнають: "No single improvement on its own produced a dramatic leap forward" (Khan Academy blog, verbatim) |
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
| **Перші пілотні школи** | травень–червень 2026 | 1–2 школи (через знайомства Nadin у GoIT) тестують на реальних даних. **Pilot success criteria** (north-star метрики): (a) approval rate драфтів ≥75% — менеджер відправляє з мінорними правками, (b) median edit distance ≤30% — текст не переписується істотно, (c) time-to-send <5 хв на учня — швидше за писати з нуля, (d) intervention recall rate (% повернутих учнів серед flagged) ≥10% над baseline. **Якщо approval rate <60% або edit distance >50%** — Стратег/Комунікатор не дають value, треба переробляти playbook або tone-of-voice до scale-up. |
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
| <a id="proof-oulad-benchmark-2024"></a>OULAD benchmark (наш dataset) | 2024 SLR існування + PRISMA + 17 articles (2017–2024) verified. **Best-published XGBoost: F1 = 0.92 / AUC = 0.97** (cross-confirmed через незалежні 2024 web-summaries, ceiling); типове XGBoost у production: F1 ≈ 0.85–0.91. Full SLR-numbers за Springer paywall | **Springer 2024 SLR** (Predictive Modelling with OULAD) — [link](https://link.springer.com/chapter/10.1007/978-3-031-64315-6_46) | [oulad-benchmark-2024](proofs/empirical/oulad-benchmark-2024/notes.md) ⚠️ partial (paywall) |
| <a id="proof-maic-dropout"></a>MAIC dropout LLM-multi-agent (direct prior art) | **CPADP framework**: PLM+MLP fine-tune → **95.4% acc / F1=0.935** (verbatim verified); GPT-4 few-shot baseline **77.9% / F1=0.604** (verbatim); **+78.6% re-logins (14→25)** — методологічно слабкий (n=17, 6 days, no control) — verbatim verified | **arxiv 2508.17310** (Aug 2025), Tsinghua/MAIC group — [link](https://arxiv.org/abs/2508.17310) | [maic-dropout-2025](proofs/empirical/maic-dropout-2025/notes.md) ✅ |
| <a id="proof-moodle-catboost-2025"></a>Moodle CatBoost (2025) | CatBoost на student activity logs — state-of-the-art tree boosting для tabular dropout prediction | **Nature Sci Reports 2025** — [link](https://www.nature.com/articles/s41598-025-93918-1) | inline citation (proof TBD) |
| <a id="proof-whitehill-mooc-dropout"></a>AUC churn-моделі (production) | **87.33% AUC**; post-hoc 90.20% AUC; різниця 2.87 п.п. | **Whitehill et al. 2017** (arxiv 1702.06404), 40 HarvardX MOOCs × 8 тижнів | [whitehill-mooc-dropout](proofs/empirical/whitehill-mooc-dropout/notes.md) |
| <a id="proof-nickow-tutoring-meta"></a>Modern tutoring meta (AERJ 2024 peer-reviewed) — наш baseline | **Pooled ES 0.29σ** (verbatim, AERJ 2024); 89 studies, 732 effect estimates; cross-corroborated by [AIBM 2024](https://aibm.org/research/the-strong-positive-effects-of-high-dose-tutoring-for-boys-and-girls/). NBER 2020 working paper цитував 0.37σ — peer-review зрізав вниз. "None replicate Bloom 2σ" — наша інтерпретація pooled-результатів, не verbatim claim | **Nickow, Oreopoulos & Quan 2024** AERJ 61(1):74–107 ([DOI](https://journals.sagepub.com/doi/10.3102/00028312231208687)); **2020 NBER WP** [w27476](https://www.nber.org/papers/w27476) як superseded version | [nickow-tutoring-meta](proofs/empirical/nickow-tutoring-meta/notes.md) ✅ (re-verified 2026-05-10) |
| <a id="proof-bloom-2-sigma"></a>Bloom 2-sigma problem (історичний, **оспорений**) | 1-on-1 tutoring → effect size **2.0σ** (98-й перцентиль) — original Bloom 1984. **Caveat**: 2σ частково артефакт mastery-threshold дизайну (90% bar для tutees, нічого для control) — див. [Education Next](https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/), [Nintil systematic review](https://nintil.com/bloom-sigma/) | **Bloom 1984** (Educational Researcher, peer-reviewed) | [bloom-2-sigma](proofs/empirical/bloom-2-sigma/notes.md) |
| <a id="proof-intelligent-tutoring-wiki"></a>AI tutoring meta-analysis (modern ITS) | Median ES **0.66** (50→75 перцентиль), перемога у 46/50 порівнянь (92%); ITS на локальних тестах ES 0.73 vs **0.13 standardized**; VanLehn 2011 — human tutors 0.79σ, step-based ITS **0.76σ** (28 порівнянь), substep-based 0.40σ, answer-based ITS **0.31σ** (165 досліджень); K-12 contested (Kulik & Fletcher: 0.40 SD на K-12 math vs Steenbergen-Hu & Cooper 2013: ~0) | **Kulik & Fletcher 2016** meta-analysis 50 досліджень; **VanLehn 2011** Educational Psychologist 46(4) | [intelligent-tutoring-wiki](proofs/empirical/intelligent-tutoring-wiki/notes.md) |

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

### 15.3 Competitive landscape & industry signals (нові sources, додані 2026-05-09)

| Showcase | Цифра / claim | Primary source | Proof |
|---|---|---|---|
| <a id="proof-edtech-saas-churn"></a>EdTech B2B SaaS churn | **9.6% monthly** — найвищий серед всіх вертикалей (verbatim verified); "a rate that has doubled since 2024" (verbatim, re-verified 2026-05-10). Конкретного "11%→22% YoY" числа в source НЕ було — формулювання видалено з §1 | [Artisan Strategies — 2026 SaaS Churn Benchmarks](https://www.artisangrowthstrategies.com/blog/saas-churn-rate-benchmarks-2026-500-companies) | [edtech-saas-churn-2026](proofs/empirical/edtech-saas-churn-2026/notes.md) ✅ |
| <a id="proof-edsights"></a>EdSights (closest direct competitor) | **250+ universities + 62% engagement rate** (homepage verbatim, re-verified 2026-05-10); +7% retention avg (case studies + WaPo 2024 op-ed, не на homepage); **Pricing $5–$15/student** з 2020 AlleyWatch profile (не на live site). "100+ languages" — раніше цитувалося, але не з'являється на homepage станом на 2026-05-10 → видалено з §2.1 | [edsights.com](https://www.edsights.com/); [WaPo 2024 op-ed](https://www.washingtonpost.com/opinions/2024/05/01/edsights-college-ai-student-retention/); [AlleyWatch 2020 — pricing reference](https://www.alleywatch.com/2020/02/edsights-chatbot-college-dropout-retention-claudia-carolina-recchi/) | [edsights](proofs/empirical/edsights/notes.md) ⚠️ partial (pricing not on live site; "100+ languages" unverified) |
| <a id="proof-civitas-starfish"></a>Civitas Learning + Starfish | Student Impact Platform; "individualized, proactive student support through centralized data, real-time insights, and coordinated workflows" (verbatim) | [civitaslearning.com/platform](https://www.civitaslearning.com/platform/) | [civitas-starfish](proofs/empirical/civitas-starfish/notes.md) ✅ |
| <a id="proof-online-he-dropout-slr-2024"></a>Online HE dropout systematic review 2024 | 110 articles; 5 pillars предикторів (demographic / course / technology / motivational / support — verbatim verified). Specific log-features (days-since-last-access etc.) — у supplementary Table S4, не у HTML | [Springer 2024 — Int J Educ Tech HE](https://educationaltechnologyjournal.springeropen.com/articles/10.1186/s41239-024-00450-9) | [online-he-dropout-slr-2024](proofs/empirical/online-he-dropout-slr-2024/notes.md) ✅ |
| <a id="proof-n8n-limitations"></a>n8n multi-agent limitations | Coordination overhead, quality drift, token explosion, security failure modes (verbatim verified). **Anthropic numbers (verbatim 2026-05-10)**: "the lead agent spins up 3-5 subagents in parallel"; "Simple fact-finding requires just 1 agent with 3-10 tool calls, direct comparisons might need 2-4 subagents with 10-15 calls each". **5–7 tools sweet spot — НЕ в публічному Anthropic doc, видалено**. "Duplicate charges / corrupted records" — параграфовано з MindStudio | [n8n blog — Multi-agent systems](https://blog.n8n.io/multi-agent-systems/); [Anthropic — multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system); [MindStudio — n8n vs agentic workflows](https://www.mindstudio.ai/blog/n8n-vs-agentic-workflows-when-to-use-each) | [n8n-multi-agent-limits](proofs/empirical/n8n-multi-agent-limits/notes.md) ⚠️ partial |
| <a id="proof-khanmigo-modest"></a>Khanmigo (caveat для AI-tutor narrative) | **6.1 percentage-point improvement** on next-item correctness (verbatim verified, складається з +3.4pp recent history + +2.7pp surfacing prerequisites). Authors' own framing (verbatim 2026-05-10): "No single improvement on its own produced a dramatic leap forward". **"Non-event" / "lower-performing students no gains"** — НЕ в Khan Academy blog, видалено з §12 | [Khan Academy blog 2025](https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/) | [khanmigo-modest-effects](proofs/empirical/khanmigo-modest-effects/notes.md) ⚠️ partial (6.1pp confirmed; demographic breakdown not provided in source) |
| <a id="proof-uplift-edu-rct"></a>Uplift modelling for student dropout (RCT example) | Persuadable-targeting перевершує propensity-targeting на student data; вимагає RCT-randomized treatment assignment | [Sciencedirect — Uplift Modeling for preventing student dropout](https://www.sciencedirect.com/science/article/pii/S0167923620300750) | inline citation (proof TBD — Sciencedirect Cloudflare-blocked) |

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
**Останнє оновлення**: 2026-05-10 (red-team round 2: §1.4 9.6% churn перефразовано як complementary signal, не "stronger-than-MOOC"; §1 dropout target **переанкорений на bracket EdSights +7% (floor) → tutoring 15–25% (ceiling), результат 7–15% з пілот-валідацією exact value** — прибрано back-of-envelope intensity-multiplier, обидва кінці bracket'а мають peer-reviewed citation; §2.3 додано wedge≠moat defensibility caveat з RCT-data flywheel як post-pilot moat; §4.0 додано **agent decomposition justification** — Спостерігач/Аналітик розділені по data-scope і token-budget, Стратег/Комунікатор по audit-ability; §4.1 Спостерігач переформульовано як **multi-source** input (primary = real OULAD homework+LMS, secondary = synthetic chats) для усунення circular-demo ризику; §13 pilot-row отримала explicit success criteria — approval rate ≥75%, edit distance ≤30%, time-to-send <5хв, intervention recall ≥10%. Попередній раунд: citation audit fixes — Nickow → AERJ 2024 0.29σ/89 studies; VanLehn step-based → 0.76σ; EdSights "100+ languages" видалено; EdSights "140+" → "250+" у §12; Anthropic "5–7 tools" → verifiable "3–5 subagents / 3–10 tool calls"; OULAD ceiling 0.92/0.97 + типове 0.85–0.91; Khanmigo "non-event" видалено; churn "11%→22% YoY" видалено)
**Команда**: Arsenii (FE+BE+AI), Дмитро + Микола (AI agents + n8n), Олексій + Маргарита (data), Гюльзар (UX), Еріка (content+presentation), Nadin (tech lead + BA)
**Дедлайн хакатона**: 18 травня 2026
