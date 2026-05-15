import fs from 'fs';
import path from 'path';
import type { Knex } from 'knex';

/**
 * Seed: replace the `homework` rows produced by 01_oulad_sample.ts with a
 * tighter, weekly-cadence variant from data/homework_variant.csv.
 *
 * The CSV covers exactly the same 15 students × 6 assignments as the OULAD
 * sample, but compresses deadlines into a 6-week bootcamp (Apr–May 2026) and
 * carries realistic completed-course outcomes (more `graded`, fewer placeholder
 * `missed`, clearer HIGH_RISK trajectories).
 *
 * Order is significant: this file is named `02_*` so Knex runs it strictly
 * after `01_oulad_sample.ts` (which `.del()`s + inserts the wide-deadline
 * variant). Here we TRUNCATE `homework` again and reload from the CSV.
 *
 * Idempotent.
 */

type Status = 'missed' | 'late' | 'submitted' | 'graded';

interface HomeworkRow {
  student_id: string;
  hw_id: string;
  module: number;
  title: string;
  topic: string;
  deadline: string; // YYYY-MM-DD
  submitted_at: string | null; // ISO timestamp or null
  status: Status;
  grade: number | null;
}

function parseDeadline(us: string): string {
  // "04/04/2026" -> "2026-04-04"
  const parts = us.split('/');
  const [m, d, y] = parts;
  if (!m || !d || !y) throw new Error(`bad deadline: ${us}`);
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseCsv(filePath: string): HomeworkRow[] {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const allLines = raw.split(/\r?\n/);
  const headerLine = allLines[0];
  const lines = allLines.slice(1);
  if (!headerLine) throw new Error('empty CSV');
  const headers = headerLine.split(',');

  const required = [
    'student_id',
    'hw_id',
    'module',
    'title',
    'topic',
    'deadline',
    'submitted_at',
    'status',
    'grade',
  ] as const;
  const colIdx: Record<(typeof required)[number], number> = {} as never;
  for (const name of required) {
    const i = headers.indexOf(name);
    if (i < 0) throw new Error(`missing CSV column: ${name}`);
    colIdx[name] = i;
  }

  return lines.map((line) => {
    const cols = line.split(',');
    const get = (name: (typeof required)[number]): string => {
      const v = cols[colIdx[name]];
      if (v === undefined) throw new Error(`missing value for ${name} in: ${line}`);
      return v;
    };
    const submitted = get('submitted_at');
    const grade = get('grade');

    return {
      student_id: get('student_id'),
      hw_id: get('hw_id'),
      module: parseInt(get('module'), 10),
      title: get('title'),
      topic: get('topic'),
      deadline: parseDeadline(get('deadline')),
      submitted_at: submitted === 'NULL' || submitted === '' ? null : submitted,
      status: get('status') as Status,
      grade: grade === 'NULL' || grade === '' ? null : parseInt(grade, 10),
    };
  });
}

export async function seed(knex: Knex): Promise<void> {
  const csvPath = path.resolve(__dirname, '../../data/homework_variant.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`homework_variant.csv not found at ${csvPath}`);
  }

  const rows = parseCsv(csvPath);

  await knex('homework').del();
  await knex.batchInsert('homework', rows, 100);

  // eslint-disable-next-line no-console
  console.log(
    `[seed] homework_variant: loaded ${rows.length} rows ` +
      `(${rows.filter((r) => r.status === 'graded').length} graded, ` +
      `${rows.filter((r) => r.status === 'missed').length} missed, ` +
      `${rows.filter((r) => r.status === 'submitted').length} submitted)`
  );
}
