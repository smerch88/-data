// Demo "as-of" date: the day we pretend the analysis is run on. Drives the
// n8n scan (as_of_date), the data cutoff, and the displayed course phase.
// State/persistence lives in asOfContext.tsx (app-wide single source).
export const DEFAULT_AS_OF = '2025-08-21';

function isIsoDate(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export const AS_OF_MIN = '2024-01-01';
export const AS_OF_MAX = '2026-12-31';

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function clampIso(iso: string): string {
  if (iso < AS_OF_MIN) return AS_OF_MIN;
  if (iso > AS_OF_MAX) return AS_OF_MAX;
  return iso;
}

/** Shift an ISO date by N days / months (UTC, no tz drift); result clamped. */
export function shiftIso(iso: string, amount: number, unit: 'day' | 'month'): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  if (unit === 'day') d.setUTCDate(d.getUTCDate() + amount);
  else d.setUTCMonth(d.getUTCMonth() + amount);
  return clampIso(toIso(d));
}

/** Position (0..1) of `iso` within [start,end]; clamped. */
export function ratioInRange(iso: string, start: string, end: string): number {
  const a = Date.parse(start);
  const b = Date.parse(end);
  const x = Date.parse(iso);
  if (!(b > a)) return 0;
  return Math.min(1, Math.max(0, (x - a) / (b - a)));
}

export type Phase = 'not_started' | 'in_progress' | 'finished' | 'unknown';

export interface CoursePhase {
  phase: Phase;
  label: string;
  progressPct: number | null; // course completion at asOf (0..100), in_progress only
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

/** Course phase RELATIVE TO the chosen as-of date (not the real calendar). */
export function coursePhase(
  start: string | null,
  end: string | null,
  asOf: string,
): CoursePhase {
  if (!isIsoDate(start) || !isIsoDate(end) || !isIsoDate(asOf)) {
    return { phase: 'unknown', label: 'Період курсу невідомий', progressPct: null };
  }
  if (dayDiff(asOf, start) < 0) {
    return { phase: 'not_started', label: 'Курс ще не почався', progressPct: null };
  }
  if (dayDiff(asOf, end) > 0) {
    return { phase: 'finished', label: 'Курс завершено', progressPct: 100 };
  }
  const total = Math.max(1, dayDiff(end, start));
  const done = Math.min(total, Math.max(0, dayDiff(asOf, start)));
  return {
    phase: 'in_progress',
    label: 'Курс у процесі',
    progressPct: Math.round((done / total) * 100),
  };
}
