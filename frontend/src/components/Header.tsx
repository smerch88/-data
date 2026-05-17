import { Fingerprint, LogOut, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsOf } from '@/lib/asOfContext';

// Static identity — this is a small internal tool with no auth layer (by design).
// The demo "moment of reality" control lives in <DemoBar/> above the header.
export function Header() {
  // In this simulation "today" IS the chosen demo moment (the DemoBar as-of
  // date) — NOT the real machine clock. They must coincide.
  const { asOf } = useAsOf();
  const today = new Date(`${asOf}T00:00:00`).toLocaleDateString('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <header className="flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2.5 h-[60px]">
        <Fingerprint className="size-6 text-ink" strokeWidth={1.5} />
        <div className="text-[14px] leading-tight tracking-tight font-brand">
          <div className="font-normal">Student</div>
          <div>
            <span className="underline decoration-1 underline-offset-2">Success</span>
            <span className="font-medium"> Agent</span>
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-5">
        <div
          className="hidden md:flex flex-col items-end leading-tight"
          title="«Сьогодні» в демо = обраний момент реальності (дата у смузі вище). Симуляція працює станом на цю дату."
        >
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            <CalendarDays className="size-3.5" />
            Сьогодні (демо)
          </span>
          <span className="text-sm font-medium text-ink first-letter:uppercase">{today}</span>
        </div>
        <button
          title="Вийти"
          className="grid place-items-center size-[60px] rounded-full bg-white border border-brand/30 text-ink hover:bg-brand-50"
        >
          <LogOut className="size-5" />
        </button>
        <div className="flex items-center gap-2 h-[60px] rounded-md bg-white px-3">
          <div className="size-10 rounded-full bg-brand-100 grid place-items-center text-brand font-semibold">
            ОС
          </div>
          <div className="leading-tight">
            <div className="text-sm">Олена Сидоренко</div>
            <div className="text-xs text-neutral-500">Course manager</div>
          </div>
        </div>
      </div>
    </header>
  );
}
