import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Risk delta vs the previous analysis run ("динаміка ризику / з минулого аналізу").
 * `delta == null` → no prior snapshot yet (first scan); render an honest placeholder.
 * Risk going UP is bad (red ↑); going DOWN is good (green ↓).
 */
export function TrendDelta({
  delta,
  prev,
  current,
  unit = 'п.п.',
  className,
}: {
  delta: number | null;
  prev?: number | null;
  current?: number | null;
  unit?: string;
  className?: string;
}) {
  if (delta == null) {
    return (
      <span className={cn('text-xs font-medium text-neutral-400', className)}>
        немає попередніх даних
      </span>
    );
  }
  const up = delta > 0;
  const flat = delta === 0;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  const color = flat ? 'text-neutral-500' : up ? 'text-risk-high' : 'text-ok';
  return (
    <span className={cn('flex flex-col gap-0.5', className)}>
      <span className={cn('flex items-center gap-1 text-sm font-bold', color)}>
        <Icon className="size-4" />
        {flat ? '0' : `${up ? '+' : ''}${delta}`} {unit}
      </span>
      {prev != null && current != null && (
        <span className="text-xs text-neutral-500">
          ({prev}% → {current}%)
        </span>
      )}
    </span>
  );
}
