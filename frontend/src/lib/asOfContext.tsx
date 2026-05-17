import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_AS_OF } from './asOf';

const KEY = 'demoAsOf';
const CALC_KEY = 'demoCalc';
const isIso = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Tunable constants the deterministic ("Пораховано з даних") cards use.
 * Defaults mirror the original hardcoded SQL literals. */
export interface CalcConsts {
  /** "Активні" = ≥1 login within this many days up to the demo date. */
  activeWindowDays: number;
  /** "Неактивні" / "поза впливом" = NO login for ≥ this many days. */
  inactiveDays: number;
  /** Exam "оцінено" pass mark (grade ≥ this). */
  examPassMark: number;
}
export const DEFAULT_CALC: CalcConsts = {
  activeWindowDays: 14,
  inactiveDays: 60,
  examPassMark: 40,
};

const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
function sanitizeCalc(c: Partial<CalcConsts> | null | undefined): CalcConsts {
  return {
    activeWindowDays: clampInt(c?.activeWindowDays, 1, 365, DEFAULT_CALC.activeWindowDays),
    inactiveDays: clampInt(c?.inactiveDays, 1, 365, DEFAULT_CALC.inactiveDays),
    examPassMark: clampInt(c?.examPassMark, 0, 100, DEFAULT_CALC.examPassMark),
  };
}

interface Ctx {
  /** Demo "moment of reality" — drives a NEW scan + the live cutoff. */
  asOf: string;
  setAsOf: (d: string) => void;
  /** Selected historical run to revisit (null = live / latest). */
  selectedRunId: number | null;
  setSelectedRunId: (id: number | null) => void;
  /** Tunable constants for the deterministic data cards. */
  calc: CalcConsts;
  setCalc: (patch: Partial<CalcConsts>) => void;
  resetCalc: () => void;
}
const AsOfCtx = createContext<Ctx | null>(null);

/** App-wide demo state. One source of truth so the header/timeline drive
 * data fetching on every page. asOf + calc persist to localStorage; the
 * selected run is in-memory (a fresh load starts on the live view). */
export function AsOfProvider({ children }: { children: ReactNode }) {
  const [asOf, setAsOfState] = useState<string>(() => {
    try {
      const s = localStorage.getItem(KEY);
      return isIso(s) ? s : DEFAULT_AS_OF;
    } catch {
      return DEFAULT_AS_OF;
    }
  });
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [calc, setCalcState] = useState<CalcConsts>(() => {
    try {
      const raw = localStorage.getItem(CALC_KEY);
      return sanitizeCalc(raw ? JSON.parse(raw) : null);
    } catch {
      return DEFAULT_CALC;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, asOf);
    } catch {
      /* ignore */
    }
  }, [asOf]);

  useEffect(() => {
    try {
      localStorage.setItem(CALC_KEY, JSON.stringify(calc));
    } catch {
      /* ignore */
    }
  }, [calc]);

  const setAsOf = (d: string) => {
    setAsOfState(isIso(d) ? d : DEFAULT_AS_OF);
    // Changing the demo date means "go live at this date" — drop any
    // historical run selection so the two controls never contradict.
    setSelectedRunId(null);
  };

  // calc only affects deterministic data math (re-fetched on change); it does
  // NOT touch which run is selected, so we don't reset selectedRunId here.
  const setCalc = (patch: Partial<CalcConsts>) =>
    setCalcState((prev) => sanitizeCalc({ ...prev, ...patch }));
  const resetCalc = () => setCalcState(DEFAULT_CALC);

  return (
    <AsOfCtx.Provider
      value={{ asOf, setAsOf, selectedRunId, setSelectedRunId, calc, setCalc, resetCalc }}
    >
      {children}
    </AsOfCtx.Provider>
  );
}

export function useAsOf(): Ctx {
  const c = useContext(AsOfCtx);
  if (!c) throw new Error('useAsOf must be used within <AsOfProvider>');
  return c;
}
