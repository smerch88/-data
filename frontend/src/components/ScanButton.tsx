import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { api, type ScanState } from '@/lib/api';

type Phase = 'idle' | 'starting' | 'running' | 'stalled' | 'done' | 'error';

/**
 * "Оновити аналіз": POST /analysis/scan, then poll /scan/state. n8n is async.
 * Three distinct in-flight outcomes are surfaced (the whole point of this
 * component): healthy progress, "stalled" (running but n8n produced nothing
 * past the grace window → likely dead), and an actual failed run — so a dead
 * scan no longer hides behind an innocent spinner or a false "completed ✓".
 */
export function ScanButton({
  asOfDate = '2025-08-21',
  onDone,
  noAnalysisForDate = false,
}: {
  asOfDate?: string;
  onDone?: () => void;
  /** No analysis exists for the *selected date itself* (an older
   * auto-resolved run may still be on screen) → label is "Зробити аналіз"
   * (create — runs for the selected date) rather than "Оновити аналіз"
   * (refresh). An explicit historical pick stays "Оновити". */
  noAnalysisForDate?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [state, setState] = useState<ScanState | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // The /scan/state poll fires every 5s — guard so a "stalled" run raises
  // exactly one toast, not one per tick.
  const stalledToasted = useRef(false);
  // Server is the source of truth for "a scan is running" — phase is local
  // and resets on remount, so we track it via a ref (also avoids a stale
  // `phase` closure inside the poll interval).
  const runningRef = useRef(false);

  function stop() {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }

  // Map one /scan/state reading to a phase. stalled ⊂ inProgress, so it must
  // be checked first; "not in flight anymore" splits into failed vs done.
  function apply(s: ScanState) {
    setState(s);
    if (s.stalled) {
      runningRef.current = true;
      setPhase('stalled');
      if (!stalledToasted.current) {
        stalledToasted.current = true;
        toast.warning('Аналіз застряг', {
          description:
            'n8n не пише результати. Перевір, що воркфлоу активні, або видали цей запуск на таймлайні. Сам впаде за ~5 хв.',
        });
      }
    } else if (s.inProgress) {
      runningRef.current = true;
      setPhase('running');
    } else if (runningRef.current || s.justCompleted) {
      runningRef.current = false;
      stop();
      if (s.runStatus === 'failed') {
        setPhase('error');
        toast.error('Аналіз не завершився', {
          description:
            'n8n не відповів або впав. Перевір активність воркфлоу n8n та лог виконання, або видали цей запуск на таймлайні.',
        });
      } else {
        setPhase('done');
        toast.success('Аналіз завершено');
        onDone?.();
      }
    } else {
      stop(); // not running and never was — nothing to wait for
    }
  }

  function poll() {
    stop();
    timer.current = setInterval(async () => {
      try {
        apply(await api.scanState());
      } catch {
        /* keep polling; transient */
      }
    }, 5000);
  }

  // Resume after a page refresh / a scan started elsewhere — phase is local
  // and would otherwise show idle while n8n is still working (or stalled).
  useEffect(() => {
    let alive = true;
    api
      .scanState()
      .then((s) => {
        if (!alive) return;
        setState(s);
        if (s.stalled || s.inProgress) {
          runningRef.current = true;
          setPhase(s.stalled ? 'stalled' : 'running');
          poll();
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setPhase('starting');
    // Drop the previous run's reading immediately. analysis_results still
    // holds the prior run's 15 rows (POST /scan doesn't clear them), so a
    // stale `state` would make the button flash "15/15" until the first
    // poll resets it to the real 0/15. Null → neutral "Аналіз виконується…".
    setState(null);
    stalledToasted.current = false;
    try {
      const r = await api.triggerScan(asOfDate);
      if (!r.triggered) {
        if (r.blocked) {
          // a scan is already running — attach to it instead of erroring
          runningRef.current = true;
          setPhase('running');
          setTimeout(poll, 1000);
          return;
        }
        setPhase('error');
        toast.error('Не вдалося запустити аналіз', {
          description: r.error || 'n8n не прийняв запит',
        });
        return;
      }
      runningRef.current = true;
      setPhase('running');
      // give n8n a moment to register the first writes, then poll
      setTimeout(poll, 4000);
    } catch (e) {
      setPhase('error');
      toast.error('Помилка запуску аналізу', {
        description: e instanceof Error ? e.message : 'Невідома помилка',
      });
    }
  }

  const busy = phase === 'starting' || phase === 'running' || phase === 'stalled';
  // Clamp to [0, total]: defends the UI if analysis_results ever carries
  // residue (the historical NULL-row "17/15" class of bug) or during a
  // mid-run row churn — progress must never read >total or negative.
  const progress = state
    ? Math.min(Math.max(0, state.freshCount ?? state.analyzedCount), state.totalStudents)
    : 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="dark"
        onClick={start}
        disabled={busy}
        className={
          'h-[58px] px-5 text-base' +
          (phase === 'stalled' ? ' !bg-amber-500 !text-white' : '')
        }
      >
        {phase === 'stalled' ? (
          <AlertTriangle className="size-4" />
        ) : busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : noAnalysisForDate ? (
          <Sparkles className="size-4" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {phase === 'starting' && 'Запуск…'}
        {phase === 'running' &&
          (state ? `Аналіз… ${progress}/${state.totalStudents}` : 'Аналіз виконується…')}
        {phase === 'stalled' && 'Аналіз застряг…'}
        {(phase === 'idle' || phase === 'done' || phase === 'error') &&
          (noAnalysisForDate ? 'Зробити аналіз' : 'Оновити аналіз')}
      </Button>
    </div>
  );
}
