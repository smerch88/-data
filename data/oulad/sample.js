#!/usr/bin/env node
/**
 * OULAD → our schema sampler.
 *
 * Reads OULAD CSV files and produces a sampled JSON dataset that maps
 * to our 5-table schema (students, mentors, courses, homework, slack_messages).
 *
 * Strategy:
 *  - Pick module-presentation AAA-2013J (smallest STEM module, 268 days, 383 students,
 *    diverse final_result distribution).
 *  - Sample ~15 students proportionally across final_result categories so we
 *    cover all 4 demo personas (HIGH RISK / MEDIUM / SILENT BUT OK / FALSE ALARM).
 *  - Map AAA-2013J → "Algebra Foundations" course (renamed for relatability).
 *  - Invent 3 mentors and assign students round-robin.
 *  - For each student, take their actual assessments and submission dates.
 *  - Generate synthetic Slack messages aligned with their real engagement pattern
 *    (active vs struggling vs silent), anchored to assessment dates.
 *
 * Output: data/oulad/sample.json (consumed by backend seed file).
 *
 * Source: Kuzilek, Hlosta, Zdrahal (2017). OULAD: Open University Learning
 * Analytics Dataset. figshare. CC BY 4.0.
 * https://doi.org/10.6084/m9.figshare.5081998.v1
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_DIR = __dirname;
const TARGET_MODULE = 'AAA';
const TARGET_PRESENTATION = '2013J';
const SAMPLE_BY_OUTCOME = {
  Distinction: 1, // FALSE ALARM (looks low-engagement but ends well)
  Pass: 8, // including 1-2 SILENT BUT OK
  Fail: 3, // MEDIUM RISK
  Withdrawn: 3, // HIGH RISK
};
// Course presentation start date — anchor for synthesizing real timestamps.
// AAA 2013J means October 2013 presentation. We use a recent fictional anchor
// for the demo so dates feel current.
const PRESENTATION_START = new Date('2026-04-01T00:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = fields[i];
    return row;
  });
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes && c === '"' && line[i + 1] === '"') {
      // Escaped quote inside a quoted field
      current += '"';
      i++;
    } else if (c === '"') {
      // Toggle quoted-field state
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  out.push(current);
  return out;
}

function dateFromOffset(offsetDaysFromStart) {
  return new Date(PRESENTATION_START.getTime() + Number(offsetDaysFromStart) * DAY_MS);
}

// Hash a number to a stable index so sampling is deterministic per-id.
function pseudoIndex(id, mod) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

const FIRST_NAMES = [
  'Олена', 'Андрій', 'Марія', 'Ігор', 'Наталія', 'Олег', 'Катерина',
  'Дмитро', 'Юлія', 'Сергій', 'Анна', 'Тарас', 'Софія', 'Микола', 'Вікторія',
  'Богдан', 'Оксана', 'Павло', 'Іра', 'Роман',
];
const LAST_NAMES = [
  'Шевченко', 'Бондаренко', 'Ковальчук', 'Ткаченко', 'Мельник', 'Кравченко',
  'Олійник', 'Шевчук', 'Поліщук', 'Бойко', 'Гончарук', 'Лисенко', 'Мороз',
  'Іваненко', 'Петренко',
];

function fakeName(idStudent) {
  return `${FIRST_NAMES[pseudoIndex(idStudent, FIRST_NAMES.length)]} ${LAST_NAMES[pseudoIndex(idStudent + 7, LAST_NAMES.length)]}`;
}

// Simple Ukrainian → Latin transliteration for email slugs.
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie',
  ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia',
};
function transliterate(s) {
  return s
    .toLowerCase()
    .split('')
    .map((c) => (TRANSLIT[c] !== undefined ? TRANSLIT[c] : c))
    .join('');
}
function fakeEmail(idStudent, name) {
  const slug = transliterate(name).replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
  return `${slug}.${idStudent}@example.school`;
}

const MENTORS = [
  { id: 'mentor_01', name: 'Тетяна Шкарупа', slack_id: 'U001MENTOR' },
  { id: 'mentor_02', name: 'Артем Гордієнко', slack_id: 'U002MENTOR' },
  { id: 'mentor_03', name: 'Ірина Лавріненко', slack_id: 'U003MENTOR' },
];

// Map OULAD final_result to our `students.status` and demo persona.
function classifyOutcome(finalResult) {
  switch (finalResult) {
    case 'Distinction':
      return { status: 'completed', persona: 'FALSE_ALARM' };
    case 'Pass':
      return { status: 'completed', persona: 'PASS' };
    case 'Fail':
      return { status: 'active', persona: 'MEDIUM_RISK' };
    case 'Withdrawn':
      return { status: 'dropped', persona: 'HIGH_RISK' };
    default:
      return { status: 'active', persona: 'PASS' };
  }
}

// Synthetic Slack-message templates aligned to engagement pattern.
const MESSAGE_BANK = {
  HIGH_RISK: {
    student_to_mentor: [
      'Привіт. Здається, я не встигаю по дедлайну з цим тижнем.',
      'Не розумію матеріал, можна пояснити ще раз?',
      'Складно стало, мабуть треба зробити паузу.',
      'Я подумав і, мабуть, кину курс. Дякую за все.',
      'Чесно — не можу витягнути цей темп, у мене ще робота.',
    ],
    student_in_group: [
      'Хтось теж відчуває, що темп завеликий?',
      'Це нормально, що до 11 вечора сидіти?',
      'Хто на якому уроці зараз?',
    ],
    mentor_to_student: [
      'Привіт! Помітила, що ти не з нами кілька днів. Все ок?',
      'Можемо поговорити про твій прогрес — є питання?',
      'Якщо проблема в часі — давай обговоримо, як адаптувати темп.',
    ],
  },
  MEDIUM_RISK: {
    student_to_mentor: [
      'Здається, не встигаю до дедлайну. Можна пізніше?',
      'У мене виникло питання щодо завдання.',
      'Можна повернутися до попередньої теми? Не до кінця зрозумів.',
    ],
    student_in_group: [
      'Хто вже здав ДЗ цього тижня?',
      'Питання по тестам — чи я правильно розумію?',
    ],
    mentor_to_student: [
      'Бачу що останні ДЗ із запізненням. Все добре?',
      'Запропоную додатковий матеріал по темі минулого тижня.',
    ],
  },
  PASS: {
    student_to_mentor: [
      'Дякую за фідбек по ДЗ!',
      'Можна питання щодо наступного завдання?',
      'Здав вчасно, перевірте будь ласка.',
    ],
    student_in_group: [
      'Хто вже почав фінальний проект?',
      'Знайшов цікаву статтю по темі цього тижня, скидаю у канал.',
      'Ця тема справді складна, але цікава.',
    ],
    mentor_to_student: [
      'Гарна робота по останньому ДЗ!',
      'Бачу регулярний прогрес — тримай темп.',
    ],
  },
  FALSE_ALARM: {
    student_to_mentor: [
      'Перепрошую за тишу — був у відрядженні. Дожену матеріал.',
      'Завжди тихий, але матеріал зрозумілий, дякую.',
      'Завдання здав, фінальний теж планую вчасно.',
    ],
    student_in_group: [],
    mentor_to_student: [
      'Не бачу активності в чаті. Все ок?',
      'Помітив, що ДЗ здаєш, але рідко питаєш — якщо треба пояснень, пиши.',
    ],
  },
};

function pickMessage(bank, key, idStudent, salt) {
  const arr = bank[key] || [];
  if (arr.length === 0) return null;
  return arr[pseudoIndex(idStudent + salt, arr.length)];
}

function generateSlackMessages(student, assessments, persona) {
  const messages = [];
  const bank = MESSAGE_BANK[persona] || MESSAGE_BANK.PASS;
  // Anchor message dates around assessment cut-off dates and "now".
  const now = Date.now();
  const recent30Start = now - 30 * DAY_MS;

  // Helper: emit a message at a specific timestamp.
  function emit(channel, fromStudent, text, ts) {
    if (!text) return;
    messages.push({
      student_id: student.id,
      channel_type: channel,
      is_from_student: fromStudent,
      message_text: text,
      sent_at: new Date(ts).toISOString(),
      mentioned_mentor: !fromStudent ? false : channel === 'mentor_dm',
    });
  }

  // Pattern: 1 mentor DM near each assessment for at-risk students;
  // group_chat occasional for active students; silence for dropped.
  if (persona === 'HIGH_RISK') {
    // Series: question → frustration → silence → "I quit"
    emit('mentor_dm', true,
      pickMessage(bank, 'student_to_mentor', student.id, 1),
      recent30Start + 5 * DAY_MS);
    emit('mentor_dm', false,
      pickMessage(bank, 'mentor_to_student', student.id, 2),
      recent30Start + 6 * DAY_MS);
    emit('mentor_dm', true,
      pickMessage(bank, 'student_to_mentor', student.id, 3),
      recent30Start + 11 * DAY_MS);
    emit('group_chat', true,
      pickMessage(bank, 'student_in_group', student.id, 4),
      recent30Start + 13 * DAY_MS);
    // silence 10 days, then quitting message
    emit('mentor_dm', true,
      pickMessage(bank, 'student_to_mentor', student.id, 5) ||
        'Мабуть кину курс.',
      recent30Start + 25 * DAY_MS);
  } else if (persona === 'MEDIUM_RISK') {
    emit('mentor_dm', true,
      pickMessage(bank, 'student_to_mentor', student.id, 1),
      recent30Start + 7 * DAY_MS);
    emit('mentor_dm', false,
      pickMessage(bank, 'mentor_to_student', student.id, 2),
      recent30Start + 8 * DAY_MS);
    emit('group_chat', true,
      pickMessage(bank, 'student_in_group', student.id, 3),
      recent30Start + 14 * DAY_MS);
    emit('mentor_dm', true,
      pickMessage(bank, 'student_to_mentor', student.id, 4),
      recent30Start + 22 * DAY_MS);
  } else if (persona === 'PASS') {
    emit('group_chat', true,
      pickMessage(bank, 'student_in_group', student.id, 1),
      recent30Start + 4 * DAY_MS);
    emit('mentor_dm', true,
      pickMessage(bank, 'student_to_mentor', student.id, 2),
      recent30Start + 12 * DAY_MS);
    emit('mentor_dm', false,
      pickMessage(bank, 'mentor_to_student', student.id, 3),
      recent30Start + 13 * DAY_MS);
    emit('group_chat', true,
      pickMessage(bank, 'student_in_group', student.id, 4),
      recent30Start + 21 * DAY_MS);
  } else if (persona === 'FALSE_ALARM') {
    // Silent in chat but completes — mentor pings, student responds calmly.
    emit('mentor_dm', false,
      pickMessage(bank, 'mentor_to_student', student.id, 1),
      recent30Start + 9 * DAY_MS);
    emit('mentor_dm', true,
      pickMessage(bank, 'student_to_mentor', student.id, 2),
      recent30Start + 10 * DAY_MS);
  }
  return messages;
}

// Parse vle.csv (small, ~6.4K rows) → site dim rows for our target presentation.
// Keeps full presentation catalogue (211 sites for AAA-2013J), not just sites
// visited by our 15 students — so the dim table is complete and queries like
// "which forums exist on this course" return the truth, not just our sample.
function extractVleSites() {
  const rows = parseCsv(path.join(DATA_DIR, 'vle.csv'))
    .filter((r) => r.code_module === TARGET_MODULE && r.code_presentation === TARGET_PRESENTATION);
  return rows.map((r) => ({
    id_site: Number(r.id_site),
    activity_type: r.activity_type,
    week_from: r.week_from === '' ? null : Number(r.week_from),
    week_to: r.week_to === '' ? null : Number(r.week_to),
  }));
}

// Stream studentVle.csv (~10.6M rows, 433 MB) — filter to our target presentation
// and sampled students, aggregate by (id_student, id_site, date offset). Returns
// rows shaped for the login_events table (one row per student-site-day).
//
// OULAD CSV format is predictable: every field quoted, no escapes. We bypass
// the generic parseCsvLine for ~5x speedup on this file.
async function extractLoginEvents(sampledIdSet) {
  const filePath = path.join(DATA_DIR, 'studentVle.csv');
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  // id_student → id_site → offsetDay → totalClicks
  const agg = new Map();
  let isHeader = true;
  let rowsRead = 0;
  let rowsKept = 0;

  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    if (!line) continue;
    rowsRead++;

    // "AAA","2013J","28400","546652","-10","4" → ["AAA","2013J","28400","546652","-10","4"]
    const parts = line.slice(1, -1).split('","');
    if (parts[0] !== TARGET_MODULE) continue;
    if (parts[1] !== TARGET_PRESENTATION) continue;
    if (!sampledIdSet.has(parts[2])) continue;

    rowsKept++;
    let perSite = agg.get(parts[2]);
    if (!perSite) { perSite = new Map(); agg.set(parts[2], perSite); }
    let perDay = perSite.get(parts[3]);
    if (!perDay) { perDay = new Map(); perSite.set(parts[3], perDay); }
    perDay.set(parts[4], (perDay.get(parts[4]) || 0) + Number(parts[5]));
  }

  console.error(`[sample] studentVle.csv: scanned ${rowsRead.toLocaleString()} rows, kept ${rowsKept.toLocaleString()} for our cohort`);

  const events = [];
  for (const [idStudent, perSite] of agg) {
    const studentId = `stud_${String(idStudent).padStart(6, '0')}`;
    for (const [idSite, perDay] of perSite) {
      for (const [dayOffset, sumClicks] of perDay) {
        events.push({
          student_id: studentId,
          id_site: Number(idSite),
          occurred_on: dateFromOffset(dayOffset).toISOString().slice(0, 10),
          sum_clicks: sumClicks,
        });
      }
    }
  }
  return events;
}

async function main() {
  console.error('[sample] reading OULAD CSVs ...');
  const courses = parseCsv(path.join(DATA_DIR, 'courses.csv'))
    .filter((c) => c.code_module === TARGET_MODULE && c.code_presentation === TARGET_PRESENTATION);
  if (courses.length === 0) throw new Error('Target presentation not found');

  const allAssessments = parseCsv(path.join(DATA_DIR, 'assessments.csv'))
    .filter((a) => a.code_module === TARGET_MODULE && a.code_presentation === TARGET_PRESENTATION);

  const allStudents = parseCsv(path.join(DATA_DIR, 'studentInfo.csv'))
    .filter((s) => s.code_module === TARGET_MODULE && s.code_presentation === TARGET_PRESENTATION);

  const allRegistrations = parseCsv(path.join(DATA_DIR, 'studentRegistration.csv'))
    .filter((r) => r.code_module === TARGET_MODULE && r.code_presentation === TARGET_PRESENTATION);

  const allStudentAssessments = parseCsv(path.join(DATA_DIR, 'studentAssessment.csv'));

  console.error(`[sample] loaded ${allStudents.length} students, ${allAssessments.length} assessments, ${allRegistrations.length} regs, ${allStudentAssessments.length} submissions`);

  // Bucket students by outcome
  const buckets = {};
  for (const s of allStudents) {
    (buckets[s.final_result] ||= []).push(s);
  }

  // Sample
  const sampledStudents = [];
  for (const [outcome, count] of Object.entries(SAMPLE_BY_OUTCOME)) {
    const pool = buckets[outcome] || [];
    pool.sort((a, b) => Number(a.id_student) - Number(b.id_student));
    const stride = Math.max(1, Math.floor(pool.length / count));
    for (let i = 0; i < count && i * stride < pool.length; i++) {
      sampledStudents.push(pool[i * stride]);
    }
  }

  const sampledIdSet = new Set(sampledStudents.map((s) => s.id_student));
  const regsById = Object.fromEntries(allRegistrations.map((r) => [r.id_student, r]));
  const submissionsByStudent = {};
  for (const sa of allStudentAssessments) {
    (submissionsByStudent[sa.id_student] ||= []).push(sa);
  }

  // Build courses (single course = AAA-2013J → "Algebra Foundations" demo)
  const ourCourses = [
    {
      id: `${TARGET_MODULE.toLowerCase()}_${TARGET_PRESENTATION.toLowerCase()}`,
      name: 'Algebra Foundations (Spring 2026)',
      total_modules: Math.max(1, allAssessments.length),
      duration_weeks: Math.round(Number(courses[0].module_presentation_length) / 7),
      format: 'self_paced',
    },
  ];

  // Build homework definitions (one per assessment) keyed by id_assessment.
  // Per OULAD docs, missing assessment date = takes place during last week
  // of the module-presentation; we substitute course length minus 7 days.
  const moduleLengthDays = Number(courses[0].module_presentation_length);
  const homeworkDefs = allAssessments.map((a) => {
    const rawDate = String(a.date || '').trim();
    const offsetDays = rawDate === '' ? moduleLengthDays - 7 : Number(rawDate);
    return {
      id_assessment: a.id_assessment,
      course_id: ourCourses[0].id,
      hw_id: `hw_${a.id_assessment}`,
      module: Math.ceil(offsetDays / 30) || 1,
      title: `${a.assessment_type} #${a.id_assessment}`,
      topic: a.assessment_type === 'TMA'
        ? 'Tutor-Marked Assignment'
        : a.assessment_type === 'CMA'
        ? 'Computer-Marked Assignment'
        : 'Final Exam',
      deadline_offset_days: offsetDays,
      weight: Number(a.weight),
    };
  });

  // Build students + mapping their assessments → our homework rows
  const ourStudents = [];
  const ourHomework = [];
  const ourMessages = [];

  sampledStudents.forEach((s, idx) => {
    const studentId = `stud_${String(s.id_student).padStart(6, '0')}`;
    const reg = regsById[s.id_student] || {};
    const enrollmentDate = reg.date_registration
      ? dateFromOffset(reg.date_registration)
      : PRESENTATION_START;
    const { status, persona } = classifyOutcome(s.final_result);
    const mentor = MENTORS[idx % MENTORS.length];
    const name = fakeName(s.id_student);

    const studentRow = {
      id: studentId,
      name,
      email: fakeEmail(s.id_student, name),
      slack_id: `U${String(s.id_student).padStart(6, '0')}`,
      course_id: ourCourses[0].id,
      mentor_id: mentor.id,
      enrollment_date: enrollmentDate.toISOString().slice(0, 10),
      current_module: persona === 'HIGH_RISK' ? 2 : persona === 'MEDIUM_RISK' ? 4 : 6,
      status,
      // private metadata for downstream tools
      _persona: persona,
      _oulad_id: s.id_student,
      _final_result: s.final_result,
    };
    ourStudents.push(studentRow);

    // Homework rows for this student: every assessment of the course,
    // joined with their submission (if any).
    const subsById = Object.fromEntries(
      (submissionsByStudent[s.id_student] || []).map((x) => [x.id_assessment, x])
    );

    for (const hw of homeworkDefs) {
      const sub = subsById[hw.id_assessment];
      const deadline = dateFromOffset(hw.deadline_offset_days).toISOString().slice(0, 10);
      let hwStatus = 'missed';
      let submittedAt = null;
      let grade = null;
      if (sub) {
        const submittedDate = dateFromOffset(sub.date_submitted);
        submittedAt = submittedDate.toISOString();
        const lateMs = submittedDate.getTime() - dateFromOffset(hw.deadline_offset_days).getTime();
        hwStatus = lateMs > 0 ? 'late' : 'submitted';
        grade = sub.score ? Number(sub.score) : null;
        if (grade != null && grade >= 40) hwStatus = 'graded';
      }
      ourHomework.push({
        student_id: studentId,
        hw_id: hw.hw_id,
        module: hw.module,
        title: hw.title,
        topic: hw.topic,
        deadline,
        submitted_at: submittedAt,
        status: hwStatus,
        grade,
      });
    }

    // Slack messages tied to engagement pattern
    ourMessages.push(...generateSlackMessages({ id: studentId }, [], persona));
  });

  console.error('[sample] parsing vle.csv for vle_sites dim ...');
  const ourVleSites = extractVleSites();

  console.error('[sample] streaming studentVle.csv for login_events ...');
  const ourLoginEvents = await extractLoginEvents(sampledIdSet);

  const out = {
    _meta: {
      source: 'OULAD (Kuzilek, Hlosta, Zdrahal 2017, figshare DOI 10.6084/m9.figshare.5081998)',
      license: 'CC BY 4.0',
      target_module: TARGET_MODULE,
      target_presentation: TARGET_PRESENTATION,
      sampled_students: ourStudents.length,
      assessments: homeworkDefs.length,
      generated_at: new Date().toISOString(),
    },
    courses: ourCourses,
    mentors: MENTORS,
    students: ourStudents,
    homework: ourHomework,
    slack_messages: ourMessages,
    vle_sites: ourVleSites,
    login_events: ourLoginEvents,
  };

  const outPath = path.join(DATA_DIR, 'sample.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.error(`[sample] saved → ${outPath}`);
  console.error(`[sample] courses=${out.courses.length}, mentors=${out.mentors.length}, students=${out.students.length}, homework=${out.homework.length}, messages=${out.slack_messages.length}, vle_sites=${out.vle_sites.length}, login_events=${out.login_events.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
