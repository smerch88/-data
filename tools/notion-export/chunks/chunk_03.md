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