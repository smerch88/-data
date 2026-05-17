import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
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
  noAnalysisYet = false,
}: {
  asOfDate?: string;
  onDone?: () => void;
  /** No analysis exists for the current view yet → label is "Зробити аналіз"
   * (create) rather than "Оновити аналіз" (refresh an existing one). */
  noAnalysisYet?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [state, setState] = useState<ScanState | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
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
    } else if (s.inProgress) {
      runningRef.current = true;
      setPhase('running');
    } else if (runningRef.current || s.justCompleted) {
      runningRef.current = false;
      stop();
      if (s.runStatus === 'failed') {
        setPhase('error');
        setMsg('Аналіз не завершився — n8n не відповів. Спробуй ще раз або перевір воркфлоу/видали запуск на таймлайні.');
      } else {
        setPhase('done');
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
    setMsg(null);
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
        setMsg(r.error || 'n8n не прийняв запит');
        return;
      }
      runningRef.current = true;
      setPhase('running');
      // give n8n a moment to register the first writes, then poll
      setTimeout(poll, 4000);
    } catch (e) {
      setPhase('error');
      setMsg(e instanceof Error ? e.message : 'Помилка запуску');
    }
  }

  const busy = phase === 'starting' || phase === 'running' || phase === 'stalled';
  const progress = state ? (state.freshCount ?? state.analyzedCount) : 0;

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
        ) : noAnalysisYet ? (
          <Sparkles className="size-4" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {phase === 'starting' && 'Запуск…'}
        {phase === 'running' &&
          (state ? `Аналіз… ${progress}/${state.totalStudents}` : 'Аналіз виконується…')}
        {phase === 'stalled' && 'Аналіз застряг…'}
        {(phase === 'idle' || phase === 'done' || phase === 'error') &&
          (noAnalysisYet ? 'Зробити аналіз' : 'Оновити аналіз')}
      </Button>
      {phase === 'stalled' && (
        <span className="text-xs text-amber-600 text-right max-w-[260px]">
          n8n не пише результати. Перевір, що воркфлоу активні, або видали цей
          запуск на таймлайні. Сам впаде за ~5 хв.
        </span>
      )}
      {phase === 'done' && <span className="text-xs text-ok-dark">Аналіз завершено ✓</span>}
      {phase === 'error' && (
        <span className="text-xs text-risk-high text-right max-w-[260px]">{msg}</span>
      )}
    </div>
  );
}
