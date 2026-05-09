# OULAD → наша схема: що витягнули, що змінили, що додали

Цей документ пояснює, як реальний датасет **OULAD** (Open University Learning Analytics Dataset) перетворився на наповнення нашої БД, у чому розбіжності між його схемою і тим, що ми спроектували для продукту, і де додані синтетичні дані.

## Джерело

- **Назва**: OULAD — Open University Learning Analytics Dataset.
- **Автори**: Kuzilek J., Hlosta M., Zdrahal Z. (2017).
- **Публікація**: *Scientific Data* 4, 170171. DOI [10.1038/sdata.2017.171](https://doi.org/10.1038/sdata.2017.171).
- **Дані**: figshare DOI [10.6084/m9.figshare.5081998](https://doi.org/10.6084/m9.figshare.5081998), CC BY 4.0.
- **Розмір**: 46.7 MB ZIP → 7 CSV-файлів, 32,593 студенти × 22 module-presentations × 173,912 assessment submissions × 10,655,280 VLE-кліків.
- **Період**: академічні роки 2013–2014 в Open University UK (distance-learning university).

Перевірений пруф: [docs/proofs/empirical/oulad-paper/notes.md](../../docs/proofs/empirical/oulad-paper/notes.md) (якщо буде створений) і [docs/proofs/empirical/oulad-source/](../../docs/proofs/empirical/oulad-source/).

## Що було в OULAD (7 таблиць)

```
courses                — 22 рядки
  code_module
  code_presentation
  module_presentation_length

assessments            — 207 рядків
  code_module / code_presentation / id_assessment
  assessment_type        TMA | CMA | Exam
  date                   day-offset cut-off (порожньо для exam)
  weight                 % від фінальної оцінки

studentInfo            — 32,593 рядки
  code_module / code_presentation / id_student
  gender / region / highest_education / imd_band / age_band
  num_of_prev_attempts / studied_credits / disability
  final_result           Pass | Fail | Withdrawn | Distinction

studentRegistration    — 32,593 рядки
  date_registration      коли записався (від'ємний = до старту курсу)
  date_unregistration    NULL якщо не пішов

studentAssessment      — 173,912 рядків
  id_assessment / id_student
  date_submitted         day-offset
  is_banked              перенесено з попередньої presentation
  score                  0–100; <40 = Fail

vle                    — 6,365 рядків
  id_site / activity_type / week_from / week_to

studentVle             — 10,655,280 рядків
  code_module / code_presentation / id_student / id_site
  date                   day-offset
  sum_click              кількість кліків у цей день
```

## Що ми спроектували (5 таблиць — з [PROJECT_VISION.md §5](../../docs/PROJECT_VISION.md#5-структура-бд-синтетична-для-хакатона))

```
mentors          id, name, slack_id
courses          id, name, total_modules, duration_weeks, format
students         id, name, email, course_id, mentor_id, enrollment_date,
                 current_module, status, created_at, updated_at
homework         id, student_id, hw_id, module, title, topic, deadline,
                 submitted_at, status, grade
slack_messages   id, student_id, channel_type, is_from_student, message_text,
                 sent_at, mentioned_mentor
```

## Як ми сэмплили дані

- **Обрана presentation**: `AAA-2013J` — найменший STEM-модуль, 268 днів, 383 студенти, наявні всі 4 типи `final_result` ⇒ можна показати всі демо-персони.
- **Вибірка**: 15 студентів пропорційно outcome-розподілу, кожен → одна з 4 демо-персон:
  - 1 `Distinction` → **FALSE_ALARM** (тихий, але completed)
  - 8 `Pass` → **PASS** (включно з тими, що мало пишуть = SILENT_BUT_OK)
  - 3 `Fail` → **MEDIUM_RISK**
  - 3 `Withdrawn` → **HIGH_RISK**
- **Anchor дата**: `2026-04-01` (OULAD містить тільки day-offsets від presentation start, ми трактуємо їх як "днів від 1 квітня 2026"). Це робить демо часово актуальним, а не 2013-м.
- **Курс перейменовано**: `AAA 2013J` → `"Algebra Foundations (Spring 2026)"` — щоб назва читалась людиною на демо.

## Прямий мапінг (поле → поле)

### courses

| Наше поле | OULAD-джерело | Коментар |
|---|---|---|
| `id` | `code_module + "_" + code_presentation` (lowercase) | `aaa_2013j` |
| `name` | (синтетично) | "Algebra Foundations (Spring 2026)" |
| `total_modules` | `assessments.count() WHERE code_module=AAA AND code_presentation=2013J` | 6 (тривіальна агрегація) |
| `duration_weeks` | `courses.module_presentation_length / 7` | 38 (з 268 днів) |
| `format` | (синтетично) | завжди `'self_paced'` для OULAD-даних |

### students

| Наше поле | OULAD-джерело | Коментар |
|---|---|---|
| `id` | `"stud_" + zfill(id_student, 6)` | `stud_011391` |
| `name` | (синтетично, transliterated UA-fake) | детерміністично з `id_student` |
| `email` | (синтетично) | трансліт `name` + `id_student@example.school` |
| `course_id` | константа `aaa_2013j` | усі студенти в одному курсі для демо |
| `mentor_id` | round-robin серед 3 інвентованих менторів | OULAD не має tutor-FK |
| `enrollment_date` | `studentRegistration.date_registration` (offset → ISO date) | від'ємні offset → до anchor 2026-04-01 |
| `current_module` | (евристично) | 2 для HIGH_RISK / 4 для MEDIUM / 6 для completed |
| `status` | `studentInfo.final_result` mapped: | див. таблицю нижче |

| OULAD `final_result` | Наш `students.status` | Демо-персона |
|---|---|---|
| `Distinction` | `completed` | FALSE_ALARM |
| `Pass` | `completed` | PASS |
| `Fail` | `active` | MEDIUM_RISK |
| `Withdrawn` | `dropped` | HIGH_RISK |

### homework

| Наше поле | OULAD-джерело | Коментар |
|---|---|---|
| `id` | bigserial | автогенерація |
| `student_id` | `students.id` (наше) | per-student per-assessment row |
| `hw_id` | `"hw_" + assessments.id_assessment` | `hw_1752` |
| `module` | `ceil(assessments.date / 30)` | groupування по 30-денних модулях |
| `title` | `assessment_type + " #" + id_assessment` | "TMA #1752" |
| `topic` | mapped з `assessment_type` | TMA → "Tutor-Marked Assignment" тощо |
| `deadline` | `dateFromOffset(assessments.date)` | exam (порожня date) → `length - 7` |
| `submitted_at` | `studentAssessment.date_submitted` (якщо є) | NULL якщо не здав |
| `status` | derived: див. правило нижче | |
| `grade` | `studentAssessment.score` | NULL якщо не здав |

Правило `homework.status`:
- немає submission ⇒ `missed`
- submission є, score < 40 ⇒ `late` або `submitted`
- submission є, score ≥ 40 ⇒ `graded`
- submission ≤ deadline ⇒ `submitted` (інакше `late`, але overrides → `graded` якщо score ≥ 40)

### slack_messages

| Наше поле | Походження | Коментар |
|---|---|---|
| `id` | bigserial | |
| `student_id` | `students.id` | |
| `channel_type` | (синтетично) | `mentor_dm` або `group_chat` залежно від persona |
| `is_from_student` | (синтетично) | true/false по сценарію |
| `message_text` | (синтетично) з UA-bank | вибір з 3–5 шаблонів × persona |
| `sent_at` | (синтетично) | прив'язано до now() − 30 днів + offset |
| `mentioned_mentor` | (синтетично) | true для `mentor_dm` від студента |

## Що з OULAD ми **НЕ** використали

| OULAD-таблиця/поле | Чому пропустили |
|---|---|
| `vle` | Метадані activity types (resource, oucontent, forumng тощо) — для multi-agent demo не потрібно |
| `studentVle` (10.6M рядків) | Click-stream даних понад потребу хакатона; майбутній ML-шар у post-MVP roadmap (§9.1) використовуватиме як основу для feature engineering "self-regulation" фіч (інтервали між сесіями, регулярність) — див. [proofs/empirical/eric-distance-ed/notes.md](../../docs/proofs/empirical/eric-distance-ed/notes.md) |
| `studentInfo.gender` / `region` / `age_band` / `imd_band` / `highest_education` / `disability` | Демографічні фічі — корисні для ML, але не для multi-agent демо. Свідомо опущено для зменшення scope і compliance-ризиків (GDPR, FERPA) |
| `studentInfo.num_of_prev_attempts` / `studied_credits` | Контекстні поля — не в нашому MVP |
| `assessments.weight` | Не зберігаємо — у демо grade важливіша за weighted contribution до final |
| `studentAssessment.is_banked` | Edge-case (повторне використання оцінки) — для нашого scope ігнорується |
| `studentRegistration.date_unregistration` | Замінено логічним перетворенням → `students.status='dropped'`. Точну дату виходу у демо не показуємо |

## Що ми **додали**, чого не було в OULAD

| Що | Звідки | Чому |
|---|---|---|
| `mentors` (3 рядки) | Інвентовано | OULAD не зберігає tutor-student зв'язок, але наш продукт цього потребує |
| `students.mentor_id` | Round-robin assignment | Симуляція реалістичного "1 ментор → 5 студентів" |
| `students.name` / `email` | Згенеровано детерміністично з `id_student` | OULAD анонімізований; для демо потрібні читабельні імена. Транслітеровані ukrainian-fake. |
| `slack_messages` (61 рядок) | Synthesized з UA-bank по 4 persona-патернах | OULAD не містить chat-даних. Це **головна синтетична частина** — без неї агент-Спостерігач не мав би вхідних сигналів. Тон і темп повідомлень узгоджені з реальним engagement (high-risk: тиша → "кину"; pass: регулярні питання) |
| `students.current_module` | Евристика по persona | OULAD не зберігає поточний прогрес явно — тільки financial outcome |
| `courses.format` | Завжди `'self_paced'` | OULAD-курси справді self-paced (Open University дистанційне навчання) |

## Зведення

Реальні дані OULAD дають **поведінковий і outcome-сигнал**:
- Хто записався, коли, коли (не) пішов.
- Коли і з яким результатом здавав assessments.
- Який фінальний результат курсу.

Синтетичні додані шари дають **demo-релевантний контекст**:
- Імена/email/менторів — щоб дашборд читався як реальний продукт.
- Slack-меседжі — щоб multi-agent система мала що аналізувати.

**Принцип**: будь-який сигнал, що впливає на predicted churn (homework status, submission delays, registration date) — реальний з OULAD; будь-який текстовий контекст (chat, names, mentor structure) — синтетичний, але **детерміністично прив'язаний до реального патерну поведінки**.

## Якщо потрібно змінити масштаб

Файл [`sample.js`](sample.js) містить параметри:

```js
const TARGET_MODULE = 'AAA';            // змінити на 'BBB', 'CCC', ...
const TARGET_PRESENTATION = '2013J';    // або '2014J', '2013B', ...
const SAMPLE_BY_OUTCOME = {
  Distinction: 1,
  Pass: 8,
  Fail: 3,
  Withdrawn: 3,
};
```

Перезапустити: `node data/oulad/sample.js` → перезаписує `sample.json` → `npm run seed:run` у `backend/`.

Більші модулі OULAD: `BBB`, `CCC`, `DDD`, `EEE`, `FFF`, `GGG` — всі мають `2013J` + `2014J` (плюс деякі лютневі `B`-presentations). `BBB` найбільший (~7,909 студентів — у 20× більше за `AAA`).

## Атрибуція

Усі дані використано під ліцензією CC BY 4.0. Цитата:

> Kuzilek, Jakub; Hlosta, Martin; Zdrahal, Zdenek (2017). OULAD: Open University Learning Analytics Dataset. figshare. Dataset. https://doi.org/10.6084/m9.figshare.5081998.v1
