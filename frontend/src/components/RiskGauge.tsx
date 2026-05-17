import { cn } from '@/lib/utils';

const COLOR: Record<string, string> = {
  high: '#dc2626',
  medium: '#f97316',
  low: '#16a34a',
};

/** Circular risk gauge (the donut + % from the Figma "Ризик %" component). */
export function RiskGauge({
  score,
  level,
  size = 60,
  stroke = 6,
}: {
  score: number | null;
  level: string | null;
  size?: number;
  stroke?: number;
}) {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = COLOR[level ?? ''] ?? '#94a3b8';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f4" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 grid place-items-center font-bold',
          size >= 100 ? 'text-2xl' : 'text-sm',
        )}
      >
        {score == null ? '—' : `${score}%`}
      </span>
    </div>
  );
}
