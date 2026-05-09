import path from 'path';
import fs from 'fs';
import type { Knex } from 'knex';

/**
 * Seed: load sampled OULAD dataset into the 5 tables.
 *
 * Source: data/oulad/sample.json — produced by data/oulad/sample.js from
 * the Open University Learning Analytics Dataset (Kuzilek, Hlosta, Zdrahal
 * 2017, figshare DOI 10.6084/m9.figshare.5081998, CC BY 4.0).
 *
 * Idempotent: truncates tables in dependency order before inserting.
 */

interface Course {
  id: string;
  name: string;
  total_modules: number;
  duration_weeks: number;
  format: 'bootcamp' | 'self_paced' | 'live';
}

interface Mentor {
  id: string;
  name: string;
  slack_id: string;
}

interface SampledStudent {
  id: string;
  name: string;
  email: string;
  course_id: string;
  mentor_id: string;
  enrollment_date: string;
  current_module: number;
  status: 'active' | 'paused' | 'dropped' | 'completed';
  // private (stripped before insert)
  _persona?: string;
  _oulad_id?: string;
  _final_result?: string;
}

interface SampledHomework {
  student_id: string;
  hw_id: string;
  module: number;
  title: string;
  topic: string;
  deadline: string;
  submitted_at: string | null;
  status: 'missed' | 'late' | 'submitted' | 'graded';
  grade: number | null;
}

interface SampledMessage {
  student_id: string;
  channel_type: 'mentor_dm' | 'group_chat' | 'support_chat';
  is_from_student: boolean;
  message_text: string;
  sent_at: string;
  mentioned_mentor: boolean;
}

interface Sample {
  _meta: Record<string, unknown>;
  courses: Course[];
  mentors: Mentor[];
  students: SampledStudent[];
  homework: SampledHomework[];
  slack_messages: SampledMessage[];
}

function loadSample(): Sample {
  const samplePath = path.resolve(__dirname, '../../data/oulad/sample.json');
  if (!fs.existsSync(samplePath)) {
    throw new Error(
      `OULAD sample not found at ${samplePath}. ` +
        `Run "node data/oulad/sample.js" from repo root first.`
    );
  }
  return JSON.parse(fs.readFileSync(samplePath, 'utf8'));
}

export async function seed(knex: Knex): Promise<void> {
  const sample = loadSample();

  // Clear in dependency order
  await knex('slack_messages').del();
  await knex('homework').del();
  await knex('students').del();
  await knex('courses').del();
  await knex('mentors').del();

  // Insert in dependency order
  await knex('mentors').insert(sample.mentors);
  await knex('courses').insert(sample.courses);

  const studentRows = sample.students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    course_id: s.course_id,
    mentor_id: s.mentor_id,
    enrollment_date: s.enrollment_date,
    current_module: s.current_module,
    status: s.status,
  }));
  await knex.batchInsert('students', studentRows, 50);
  await knex.batchInsert('homework', sample.homework, 100);
  await knex.batchInsert('slack_messages', sample.slack_messages, 100);

  // eslint-disable-next-line no-console
  console.log(
    `[seed] OULAD sample loaded: ` +
      `${sample.mentors.length} mentors, ` +
      `${sample.courses.length} courses, ` +
      `${sample.students.length} students, ` +
      `${sample.homework.length} homework, ` +
      `${sample.slack_messages.length} messages`
  );
}
