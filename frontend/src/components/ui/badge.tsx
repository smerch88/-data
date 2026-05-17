import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'risk-high' | 'risk-medium' | 'risk-low' | 'success' | 'neutral' | 'brand';

const tones: Record<Tone, string> = {
  'risk-high': 'bg-red-100 text-risk-high',
  'risk-medium': 'bg-orange-100 text-risk-medium',
  'risk-low': 'bg-ok-bg text-ok-dark',
  success: 'bg-ok-bg text-ok-dark',
  neutral: 'bg-neutral-100 text-neutral-600',
  brand: 'bg-brand-100 text-brand',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function riskTone(level: string | null | undefined): Tone {
  if (level === 'high') return 'risk-high';
  if (level === 'medium') return 'risk-medium';
  if (level === 'low') return 'risk-low';
  return 'neutral';
}
