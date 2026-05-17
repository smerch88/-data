import { type ReactNode } from 'react';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';
import { SourceBadge, type Source } from './SourceBadge';

export function StatCard({
  title,
  hint,
  value,
  sub,
  footer,
  accent,
  source,
  formula,
}: {
  title: string;
  hint?: string;
  value: ReactNode;
  sub?: ReactNode;
  footer?: ReactNode;
  /** Border tone driven by trend vs previous run: 'danger' = got worse (red),
   * 'positive' = improved (green), undefined = neutral. */
  accent?: 'danger' | 'positive';
  source?: Source;
  /** Exact computation shown on hover of the source badge (data metrics). */
  formula?: string;
}) {
  return (
    <Card
      className={cn(
        'h-full',
        accent === 'danger' && 'ring-1 ring-risk-high/40 shadow-danger',
        accent === 'positive' && 'ring-1 ring-ok/50',
      )}
    >
      <div className="p-6 flex flex-col gap-5 h-full">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-lg font-bold text-black">{title}</h3>
            {source && <SourceBadge source={source} tip={formula} />}
            {hint && <span className="text-xs text-neutral-500">{hint}</span>}
          </div>
          <div className="flex items-end gap-1.5">
            <span className="text-4xl font-bold tracking-tight leading-none">{value}</span>
            {sub && <span className="text-xl text-neutral-700">{sub}</span>}
          </div>
        </div>
        {footer && <div className="mt-auto">{footer}</div>}
      </div>
    </Card>
  );
}
