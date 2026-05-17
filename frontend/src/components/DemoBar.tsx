import { type ReactNode } from 'react';
import { FlaskConical, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useAsOf } from '@/lib/asOfContext';
import { DEFAULT_AS_OF, AS_OF_MIN, AS_OF_MAX, shiftIso } from '@/lib/asOf';
import { fmtDate } from '@/lib/utils';

function Step({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md bg-white/70 hover:bg-white border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors"
    >
      {children}
    </button>
  );
}

function ConstInput({
  label,
  title,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  title: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label
      title={title}
      className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 cursor-help"
    >
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))}
        className="w-14 bg-white border border-amber-300 rounded-md px-1.5 py-1 text-xs font-bold text-amber-900 outline-none"
      />
    </label>
  );
}

/**
 * Full-width demo "time machine" — sits ABOVE the header. Pick the moment of
 * reality; every factual stat below loads only up to this date. Quick steppers
 * so you don't have to open the native date picker each time.
 */
export function DemoBar() {
  const { asOf, setAsOf, calc, setCalc, resetCalc } = useAsOf();
  const step = (n: number, u: 'day' | 'month') => setAsOf(shiftIso(asOf, n, u));

  return (
    <div className="w-full border-b border-dashed border-amber-400 bg-amber-50">
      <div className="mx-auto max-w-[1440px] px-10 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2 text-amber-700">
          <FlaskConical className="size-4" />
          <span className="text-[11px] font-bold uppercase tracking-wide">
            Демо · момент реальності
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Step onClick={() => step(-1, 'month')}>− місяць</Step>
          <Step onClick={() => step(-7, 'day')}>− тиждень</Step>
          <Step onClick={() => step(-1, 'day')}>− день</Step>
        </div>

        <div className="px-3 py-1 rounded-lg bg-white border border-amber-300 text-sm font-bold text-amber-900 min-w-[170px] text-center">
          {fmtDate(asOf)}
        </div>

        <div className="flex items-center gap-1.5">
          <Step onClick={() => step(1, 'day')}>+ день</Step>
          <Step onClick={() => step(7, 'day')}>+ тиждень</Step>
          <Step onClick={() => step(1, 'month')}>+ місяць</Step>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={asOf}
            min={AS_OF_MIN}
            max={AS_OF_MAX}
            onChange={(e) => e.target.value && setAsOf(e.target.value)}
            className="bg-white border border-amber-300 rounded-md px-2 py-1 text-xs font-medium text-amber-900 outline-none"
          />
          <button
            onClick={() => setAsOf(DEFAULT_AS_OF)}
            title={`Скинути на ${DEFAULT_AS_OF}`}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-white/70"
          >
            <RotateCcw className="size-3.5" />
            скинути
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-10 pb-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-amber-300/70 pt-2">
        <div className="flex items-center gap-2 text-amber-700">
          <SlidersHorizontal className="size-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wide">
            Параметри розрахунку
          </span>
        </div>
        <ConstInput
          label="Активні: логін ≤"
          title="«Активні студенти» = студенти з ≥1 логіном за останні N днів станом на демо-дату"
          value={calc.activeWindowDays}
          min={1}
          max={365}
          onChange={(n) => setCalc({ activeWindowDays: n })}
        />
        <ConstInput
          label="Неактивні: без логіну ≥"
          title="«Неактивні» та «поза впливом» = студенти без жодного логіну ≥ N днів станом на демо-дату"
          value={calc.inactiveDays}
          min={1}
          max={365}
          onChange={(n) => setCalc({ inactiveDays: n })}
        />
        <ConstInput
          label="Іспит: бал ≥"
          title="«Оцінено» в картці іспиту = студенти з оцінкою за іспит ≥ цього балу"
          value={calc.examPassMark}
          min={0}
          max={100}
          onChange={(n) => setCalc({ examPassMark: n })}
        />
        <span className="text-[11px] text-amber-700/80">днів / днів / балів</span>
        <button
          onClick={resetCalc}
          title="Скинути параметри на 14 / 60 / 40"
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-white/70"
        >
          <RotateCcw className="size-3.5" />
          стандартні
        </button>
      </div>
    </div>
  );
}
