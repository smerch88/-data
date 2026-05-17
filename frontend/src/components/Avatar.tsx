import { useState } from 'react';
import { cn } from '@/lib/utils';

// Deterministic mock photo from the internet (pravatar), seeded by student id
// so each student keeps the same face. Falls back to initials if offline.
export function Avatar({
  seed,
  name,
  size = 40,
  className,
}: {
  seed: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name || seed)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  if (failed) {
    return (
      <div
        className={cn(
          'rounded-full bg-brand-100 text-brand grid place-items-center font-semibold shrink-0',
          className,
        )}
        style={{ width: size, height: size, fontSize: size * 0.36 }}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={`https://i.pravatar.cc/${size * 2}?u=${encodeURIComponent(seed)}`}
      alt={name || seed}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn('rounded-full object-cover bg-neutral-200 shrink-0', className)}
      style={{ width: size, height: size }}
    />
  );
}
