import { type ReactNode } from 'react';
import { Card } from './ui/card';
import { ratioInRange } from '@/lib/asOf';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import type { AnalysisRun } from '@/lib/api';
import { Radio, RotateCw, Trash2 } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  complete: 'bg-brand border-brand',
  running: 'bg-amber-400 border-amber-500',
  failed: 'bg-neutral-300 border-neutral-400',
};

/**
 * Production timeline of ANALYSIS RUNS. Straight axis = course start → end.
 * Each scan is a stored point at its as-of day; click a finished point to
 * revisit that run's frozen analysis. Amber tick = where the next scan
 * (current demo date) would land.
 */
interface Deadline {
  hwId: string;
  title: string | null;
  topic: string | null;
  module: number | null;
  date: string;
  isExam: boolean;
}

export function AnalysisTimeline({
  runs,
  hiddenCount = 0,
  start,
  end,
  asOf,
  deadlines = [],
  selectedRunId,
  onSelect,
  onDelete,
}: {
  runs: AnalysisRun[];
  hiddenCount?: number;
  start: string | null;
  end: string | null;
  asOf: string;
  deadlines?: Deadline[];
  selectedRunId: number | null;
  onSelect: (id: number | null) => void;
  /** Delete a stored run (any status — incl. failed/stuck). Optional. */
  onDelete?: (r: AnalysisRun) => void;
}) {
  if (!start || !end) return null;
  const asOfPct = ratioInRange(asOf, start, end) * 100;

  // Vertical stagger ONLY for dots whose horizontal projections actually
  // collide (< OVERLAP_PCT of the axis apart). Isolated runs sit flat on
  // the line; a colliding group is spread symmetrically around it so each
  // stays individually hoverable / clickable / deletable.
  const OVERLAP_PCT = 2;
  const STACK_STEP = 16; // px; ≥ dot diameter (size-3.5 = 14px)
  const dyById = new Map<number, number>();
  {
    const ordered = runs
      .map((r) => ({ id: r.id, left: ratioInRange(r.asOfDate, start, end) * 100 }))
      .sort((a, b) => a.left - b.left || a.id - b.id);
    let cluster: typeof ordered = [];
    const flush = () => {
      const n = cluster.length;
      cluster.forEach((c, k) => {
        dyById.set(c.id, n === 1 ? 0 : (k - (n - 1) / 2) * STACK_STEP);
      });
      cluster = [];
    };
    for (const item of ordered) {
      const prev = cluster[cluster.length - 1];
      if (!prev || item.left - prev.left < OVERLAP_PCT) {
        cluster.push(item);
      } else {
        flush();
        cluster.push(item);
      }
    }
    flush();
  }

  return (
    <Card>
      <div className="px-8 pt-6 pb-12">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-bold text-neutral-600">Таймлайн аналізів</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Кожен запуск — точка на осі курсу. Натисни завершену — щоб
              переглянути аналіз, невдалу — щоб повторити запуск.
            </p>
          </div>
          <button
            onClick={() => onSelect(null)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              selectedRunId == null
                ? 'bg-ok-bg text-ok-dark'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            <Radio className="size-3.5" />
            {selectedRunId == null ? 'Наживо (останній)' : 'Повернутись до поточного'}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-500 mt-6 mb-1 px-1">
          <span>{fmtDate(start)}</span>
          <span>{fmtDate(end)}</span>
        </div>

        <div className="relative h-1.5 rounded-full bg-neutral-200 mx-2">
          {/* where the next scan (current demo date) would land */}
          <div
            className="absolute -top-2 bottom-[-8px] w-px bg-amber-400/70"
            style={{ left: `${asOfPct}%` }}
            title={`Демо-дата (наступний аналіз): ${fmtDate(asOf)}`}
          >
            <div className="absolute -top-1 -left-1 size-2 rounded-full bg-amber-400" />
          </div>

          {/* HW / exam deadline reference ticks (below the line, never clickable) */}
          {deadlines.map((d) => {
            const left = ratioInRange(d.date, start, end) * 100;
            return (
              <div
                key={d.hwId}
                className="absolute top-full -translate-x-1/2"
                style={{ left: `${left}%` }}
                title={`${d.isExam ? 'Іспит' : 'Дедлайн ДЗ'}: ${d.title ?? d.hwId}${
                  d.topic ? ` (${d.topic})` : ''
                } — ${fmtDate(d.date)}`}
              >
                {d.isExam ? (
                  <span className="block mt-1 size-2.5 -translate-x-px rotate-45 bg-rose-500" />
                ) : (
                  <span className="block w-px h-3 bg-neutral-300" />
                )}
              </div>
            );
          })}

          {runs.length === 0 && (
            <div className="absolute inset-x-0 -bottom-8 text-center text-xs text-neutral-400">
              Ще не було жодного аналізу — натисни «Зробити аналіз»
            </div>
          )}

          {runs.map((r) => {
            const left = ratioInRange(r.asOfDate, start, end) * 100;
            const selected = r.id === selectedRunId;
            // Complete → revisit the frozen analysis; failed → pick it so the
            // scan button can retry that as-of date. Running is not selectable.
            const selectable = r.status === 'complete' || r.status === 'failed';
            const dy = dyById.get(r.id) ?? 0;
            return (
              <div
                key={r.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 group hover:z-20"
                style={{ left: `${left}%`, top: `calc(50% + ${dy}px)` }}
              >
                {/* Transparent hover bridge: a descendant of .group so the
                    cursor can travel dot → trash without losing group-hover
                    (sits behind via -z-10, never blocks the dot click). */}
                {onDelete && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 -top-1 -z-10 h-12 w-8"
                  />
                )}
                <button
                  type="button"
                  disabled={!selectable}
                  onClick={() => selectable && onSelect(r.id)}
                  title={
                    `${fmtDate(r.asOfDate)} · ${r.status}` +
                    (r.status === 'complete'
                      ? ` · ${r.high} high / ${r.medium} med / ${r.low} low`
                      : r.status === 'failed'
                        ? ' · клік — повторити аналіз'
                        : '') +
                    `\nзапущено ${fmtDateTime(r.triggeredAt)}`
                  }
                  className="block"
                >
                  <span
                    className={`block rounded-full border-2 transition-all ${
                      STATUS_COLOR[r.status] ?? 'bg-neutral-300 border-neutral-400'
                    } ${
                      selected
                        ? `size-5 ring-4 ${
                            r.status === 'failed' ? 'ring-rose-400/40' : 'ring-brand/25'
                          }`
                        : 'size-3.5'
                    } ${r.status === 'running' ? 'animate-pulse' : ''} ${
                      selectable ? 'cursor-pointer hover:scale-125' : 'cursor-default'
                    }`}
                  />
                  {selected && (
                    <span
                      className={`absolute left-1/2 -translate-x-1/2 -top-9 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${
                        r.status === 'failed' ? 'bg-rose-500' : 'bg-brand'
                      }`}
                    >
                      {fmtDate(r.asOfDate)}
                    </span>
                  )}
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(r);
                    }}
                    title={`Видалити аналіз від ${fmtDate(r.asOfDate)}`}
                    aria-label="Видалити аналіз"
                    className="absolute left-1/2 -translate-x-1/2 -bottom-6 z-20 grid place-items-center size-5 rounded-full bg-white border border-rose-300 text-rose-600 shadow-sm opacity-0 pointer-events-none transition-opacity hover:bg-rose-50 group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <Legend className="bg-brand">завершений (клік — переглянути)</Legend>
          <Legend className="bg-amber-400">виконується</Legend>
          <Legend className="bg-neutral-300">невдалий (клік — повторити)</Legend>
          <span className="flex items-center gap-1.5">
            <span className="w-px h-3 bg-neutral-400" /> дедлайн ДЗ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rotate-45 bg-rose-500" /> іспит
          </span>
          <span className="flex items-center gap-1.5">
            <RotateCw className="size-3.5" /> запусків до обраної дати: {runs.length}
          </span>
          {hiddenCount > 0 && (
            <span className="text-neutral-400" title="Аналізи, дата яких пізніша за обрану демо-дату — приховані як «майбутнє»">
              +{hiddenCount} у майбутньому приховано
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3 rounded-full ${className}`} />
      {children}
    </span>
  );
}
