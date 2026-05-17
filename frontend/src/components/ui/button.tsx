import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'subtle';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand/90',
  dark: 'bg-neutral-900 text-white hover:bg-neutral-800',
  outline: 'bg-white border border-brand text-brand hover:bg-brand-50',
  ghost: 'bg-transparent text-brand hover:bg-brand-50',
  subtle: 'bg-neutral-100 text-ink hover:bg-neutral-200',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
