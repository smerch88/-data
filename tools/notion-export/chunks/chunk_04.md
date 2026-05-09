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