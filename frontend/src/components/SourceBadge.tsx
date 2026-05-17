import { Sparkles, Calculator, FileClock } from 'lucide-react';

export type Source = 'ai' | 'data' | 'meta';

const META: Record<
  Source,
  { label: string; desc: string; cls: string; clsDark: string; Icon: typeof Sparkles }
> = {
  ai: {
    label: 'AI-метрика',
    desc: 'Судження AI-моделі (LLM через n8n) — не виміряний факт',
    cls: 'text-brand',
    clsDark: 'text-indigo-200',
    Icon: Sparkles,
  },
  data: {
    label: 'Пораховано з даних',
    desc: 'Обчислено з логінів / ДЗ / дат у БД, станом на обрану дату',
    cls: 'text-emerald-600',
    clsDark: 'text-emerald-300',
    Icon: Calculator,
  },
  meta: {
    label: 'Службовий показник',
    desc: 'Облік запусків аналізу — не AI і не метрика',
    cls: 'text-neutral-400',
    clsDark: 'text-neutral-300',
    Icon: FileClock,
  },
};

/**
 * Tiny provenance marker next to a metric title. Colour + icon make the kind
 * glanceable; the native title shows the full explanation on hover (bullet-
 * proof — never clipped by the cards' overflow-hidden, unlike a CSS popover).
 */
export function SourceBadge({
  source,
  dark = false,
  tip,
}: {
  source: Source;
  dark?: boolean;
  /** Override the hover text — e.g. the exact formula for a data metric. */
  tip?: string;
}) {
  const m = META[source];
  const Icon = m.Icon;
  return (
    <span
      className="inline-flex items-center cursor-help align-middle shrink-0"
      aria-label={m.label}
      tabIndex={0}
      title={tip ? `${m.label} · ${tip}` : `${m.label} — ${m.desc}`}
    >
      <Icon className={`size-3.5 ${dark ? m.clsDark : m.cls}`} />
    </span>
  );
}
