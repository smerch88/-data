import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, ArrowRightCircle, FileText, ArrowUpDown, History, X } from 'lucide-react';
import { Header } from '@/components/Header';
import { StatCard } from '@/components/StatCard';
import { ScanButton } from '@/components/ScanButton';
import { DemoBar } from '@/components/DemoBar';
import { AnalysisTimeline } from '@/components/AnalysisTimeline';
import { Avatar } from '@/components/Avatar';
import { SourceBadge } from '@/components/SourceBadge';
import { RiskGauge } from '@/components/RiskGauge';
import { TrendDelta } from '@/components/TrendDelta';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync } from '@/lib/useAsync';
import { api, type RiskStudent, type AnalysisRun } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import { coursePhase } from '@/lib/asOf';
import { useAsOf } from '@/lib/asOfContext';

export default function Dashboard() {
  const { asOf, selectedRunId, setSelectedRunId, calc } = useAsOf();
  const { data, loading, error, reload } = useAsync(
    () => api.overview(asOf, selectedRunId, calc),
    [asOf, selectedRunId, calc],
  );
  const runsQ = useAsync(() => api.runs(), [asOf, selectedRunId]);
  const runs = runsQ.data?.runs ?? [];
  // From the demo "moment" X, analyses for a date AFTER X are "in the future"
  // and must not be shown on the timeline (same point-in-time logic as data).
  const visibleRuns = runs.filter((r) => r.asOfDate <= asOf);
  const hiddenFuture = runs.length - visibleRuns.length;
  // The table lists the FULL analyzed roster, ordered by the backend
  // (lost ASC, risk_score DESC NULLS LAST) — most-risky first, "lost" muted
  // at the bottom. The "В групі ризику" KPI stays a narrower count (active
  // high/medium only); the two intentionally differ — see the table note.
  const allStudents = data?.riskStudents ?? [];
  const lostCount = allStudents.filter((s) => s.lost).length;
  // Course-timeline "now" = the demo date itself. It only freezes to a run's
  // date when the user EXPLICITLY opened a past run — NOT for the
  // auto-resolved live run (whose asOf is just "latest analysis ≤ demo date"
  // and must not drag the course phase backwards once the demo date moves on).
  const historicalRun =
    data?.selectedRun && !data.selectedRun.auto ? data.selectedRun : null;
  const effAsOf = historicalRun?.asOfDate ?? asOf;
  const phase = data ? coursePhase(data.course.startDate, data.course.endDate, effAsOf) : null;

  // Scan button label: "Зробити аналіз" only when there is no analysis for the
  // *selected date itself* — i.e. nothing at all, or just an older
  // auto-resolved run shown with the grey note. A run exactly at the demo date,
  // or an explicit historical pick, keeps "Оновити аналіз".
  const noAnalysisForDate = !data
    ? false // still loading — don't flip the label until we know
    : !data.selectedRun
      ? true
      : data.selectedRun.auto
        ? data.selectedRun.asOfDate !== asOf
        : false;

  // Delete a stored analysis run (any status). If the deleted run was the
  // one being viewed, drop back to live; then refresh timeline + overview.
  async function handleDeleteRun(r: AnalysisRun) {
    if (!window.confirm(`Видалити аналіз від ${fmtDate(r.asOfDate)}? Дію не можна скасувати.`)) {
      return;
    }
    const res = await api.deleteRun(r.id);
    if (!res.deleted) {
      window.alert(`Не вдалося видалити аналіз: ${res.error ?? 'невідома помилка'}`);
      return;
    }
    if (selectedRunId === r.id) setSelectedRunId(null);
    runsQ.reload();
    reload();
  }

  // Poll while any run is still processing so its point flips to "complete"
  // (the GET /runs read also triggers the lazy server-side finalize).
  useEffect(() => {
    if (!runs.some((r) => r.status === 'running')) return;
    const t = setInterval(() => {
      runsQ.reload();
      reload();
    }, 12000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs.map((r) => `${r.id}:${r.status}`).join(',')]);

  return (
    <div className="min-h-full">
      <DemoBar />
      <div className="mx-auto max-w-[1440px] px-10 py-10 flex flex-col gap-6">
        <Header />

        {error && (
          <Card>
            <div className="p-6 text-risk-high">
              Не вдалося завантажити дані: {error}.{' '}
              <button className="underline" onClick={reload}>
                Спробувати ще раз
              </button>
            </div>
          </Card>
        )}

        {/* Course header + actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              {data?.course.name ?? <Skeleton className="h-8 w-80" />}
            </h1>
            {data && phase && (
              <Badge tone={phase.phase === 'in_progress' ? 'brand' : 'neutral'}>
                {phase.label}
                {phase.phase === 'in_progress' && phase.progressPct != null
                  ? ` · ${phase.progressPct}%`
                  : ''}
                {` · станом на ${fmtDate(effAsOf)}`}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="outline" className="h-[58px] px-5 text-base" disabled title="Скоро">
              <Upload className="size-4" />
              Експорт звіту
            </Button>
            <ScanButton
              asOfDate={asOf}
              onDone={reload}
              noAnalysisForDate={noAnalysisForDate}
            />
          </div>
        </div>

        {/* No completed analysis exists on/before the simulated "now" */}
        {data?.noAnalysisYet && (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-amber-400 bg-amber-50 px-5 py-3 text-sm">
            <History className="size-4 text-amber-600" />
            <span className="text-amber-800">
              Аналізу станом на <b>{fmtDate(asOf)}</b> ще не було. Нижче — лише фактичні
              показники (логіни/ДЗ); ризик-аналіз зʼявиться після «Зробити аналіз».
            </span>
          </div>
        )}

        {/* Explicit historical pick (clicked a timeline point) */}
        {data?.selectedRun && !data.selectedRun.auto && (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-brand-200 bg-brand-50 px-5 py-3 text-sm">
            <History className="size-4 text-brand" />
            <span className="text-brand-dark">
              Історичний аналіз від <b>{fmtDate(data.selectedRun.asOfDate)}</b> (запущено{' '}
              {fmtDateTime(data.selectedRun.triggeredAt)}) — дані заморожені на цей запуск.
            </span>
            <button
              onClick={() => setSelectedRunId(null)}
              className="ml-auto flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand hover:bg-brand-100"
            >
              <X className="size-3.5" />
              до поточного
            </button>
          </div>
        )}

        {/* Live mode: AI is the latest run AS OF the demo date — note it only
            when that run's date differs from the chosen moment. */}
        {data?.selectedRun?.auto && data.selectedRun.asOfDate !== asOf && (
          <div className="flex flex-wrap items-center gap-2 rounded-card bg-neutral-100 px-5 py-2.5 text-xs text-neutral-600">
            <History className="size-3.5" />
            Показники — станом на <b>{fmtDate(asOf)}</b>; останній наявний AI-аналіз — від{' '}
            <b>{fmtDate(data.selectedRun.asOfDate)}</b>.
          </div>
        )}

        {data && (
          <AnalysisTimeline
            runs={visibleRuns}
            hiddenCount={hiddenFuture}
            start={data.course.startDate}
            end={data.course.endDate}
            asOf={asOf}
            deadlines={data.course.deadlines}
            selectedRunId={selectedRunId}
            onSelect={setSelectedRunId}
            onDelete={handleDeleteRun}
          />
        )}

        {/* Course meta + last scan */}
        <Card>
          <div className="p-5 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-neutral-600">
            <span>
              Модулів: <b className="text-ink">{data?.course.totalModules ?? '—'}</b>
            </span>
            <span>
              Тривалість: <b className="text-ink">{data?.course.durationWeeks ?? '—'} тижнів</b>
            </span>
            <span>
              Студентів:{' '}
              <b className="text-ink">
                {data
                  ? `${Math.min(data.scan.analyzedCount, data.scan.totalStudents)}/${data.scan.totalStudents} проаналізовано`
                  : '—'}
              </b>
            </span>
            <span className="ml-auto">
              Аналіз від: <b className="text-ink">{fmtDateTime(data?.scan.lastAnalyzedAt)}</b>
            </span>
          </div>
        </Card>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading && !data
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[170px] rounded-card" />)
            : data && (
                <>
                  <StatCard
                    title="Активні студенти"
                    source="data"
                    formula={`COUNT(DISTINCT студент) з ≥1 логіном за останні ${calc.activeWindowDays} дн. до демо-дати; знаменник = всі студенти`}
                    value={data.stats.activeStudents.value}
                    sub={`/ ${data.stats.activeStudents.total}`}
                    footer={
                      <span className="text-xs text-neutral-500">
                        логін за останні {calc.activeWindowDays} днів
                      </span>
                    }
                  />
                  <StatCard
                    title="Неактивні"
                    source="data"
                    formula={`Студенти БЕЗ жодного логіну за останні ${calc.inactiveDays} дн. до демо-дати`}
                    value={data.stats.dropped.value}
                    footer={
                      <span className="text-xs text-neutral-500">
                        без логіну {calc.inactiveDays}+ днів
                        {lostCount > 0 && (
                          <> · з них {lostCount} поза впливом</>
                        )}
                      </span>
                    }
                  />
                  <StatCard
                    title="Здали Д/З"
                    source="data"
                    hint="(дедлайн настав)"
                    formula="Здані ДЗ серед тих, чий дедлайн ≤ демо-дата; % = здані / усі з дедлайном, що настав"
                    value={data.stats.hwSubmitted.value}
                    sub={data.stats.hwSubmitted.pct != null ? `(${data.stats.hwSubmitted.pct}%)` : undefined}
                  />
                  <StatCard
                    title="Не зданих Д/З (всього)"
                    source="data"
                    formula="ДЗ із дедлайном ≤ демо-дата, де немає сабміту (або сабміт пізніше дедлайну)"
                    value={data.stats.hwMissedTotal.value}
                  />
                  <StatCard
                    title="Не здано / із запізненням"
                    source="data"
                    formula="Частка прострочених/незданих серед ДЗ, чий дедлайн ≤ демо-дата"
                    value={data.stats.hwNotSubmitted.value}
                    sub={
                      data.stats.hwNotSubmitted.pct != null ? `(${data.stats.hwNotSubmitted.pct}%)` : undefined
                    }
                  />
                  <StatCard
                    title="В групі ризику"
                    source="ai"
                    accent={
                      data.stats.atRisk.deltaVsPrev == null ||
                      data.stats.atRisk.deltaVsPrev === 0
                        ? undefined
                        : data.stats.atRisk.deltaVsPrev > 0
                          ? 'danger'
                          : 'positive'
                    }
                    hint="(серед активних)"
                    value={data.stats.atRisk.value}
                    sub={`/ ${data.stats.activeStudents.value}`}
                    footer={
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-neutral-500">
                          {data.stats.atRisk.value} з {data.stats.activeStudents.value} активних
                          {data.stats.activeStudents.value > 0
                            ? ` · ${Math.round(
                                (100 * data.stats.atRisk.value) /
                                  data.stats.activeStudents.value,
                              )}%`
                            : ''}
                        </span>
                        <TrendDelta
                          delta={data.stats.atRisk.deltaVsPrev ?? null}
                          unit="до мин. аналізу"
                        />
                      </div>
                    }
                  />
                  {/* Exam card — appears only once the exam deadline has
                      passed for the chosen demo date (deterministic, not
                      run-dependent). */}
                  {data.stats.exam.due && (
                    <StatCard
                      title="Іспит складено"
                      source="data"
                      formula={`DISTINCT студентів зі сабмітом іспиту ≤ демо-дата; «оцінено» = оцінка ≥ ${calc.examPassMark}; знаменник = активні`}
                      hint={
                        data.stats.exam.deadline
                          ? `(дедлайн ${data.stats.exam.deadline})`
                          : undefined
                      }
                      value={data.stats.exam.submitted}
                      sub={`/ ${data.stats.exam.total}`}
                      footer={
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-neutral-500">
                            {data.stats.exam.graded} оцінено (прохідний ≥ {calc.examPassMark})
                          </span>
                          {data.stats.exam.submitted === 0 && (
                            <span className="text-xs text-amber-600">
                              немає записів про складання у датасеті
                            </span>
                          )}
                        </div>
                      }
                    />
                  )}
                </>
              )}
        </div>

        {/* Risk table */}
        <Card>
          <div className="p-6 pb-4">
            <h2 className="text-2xl font-bold tracking-tight">Студенти у групі ризику</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Усі студенти, відсортовані за рівнем ризику (найвищий — вгорі).
              Натисни, щоб побачити деталі. Картка «В групі ризику» рахує лише
              активних high/medium — тому її число менше за весь список.
              {lostCount > 0 && (
                <span className="text-neutral-500">
                  {' '}
                  · {lostCount} поза зоною впливу (приглушені, внизу)
                </span>
              )}
            </p>
          </div>
          <div className="px-3 pb-3 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-brand-dark text-white text-left text-[15px]">
                  <th className="font-bold px-5 py-4 rounded-tl-card">
                    <span className="inline-flex items-center gap-1.5">
                      СТУДЕНТ <SourceBadge source="data" dark />
                    </span>
                  </th>
                  <th className="font-bold px-3 py-4">
                    <span className="inline-flex items-center gap-1.5">
                      РИЗИК <SourceBadge source="ai" dark />
                    </span>
                  </th>
                  <th className="font-bold px-3 py-4">
                    <span className="inline-flex items-center gap-1">
                      ДИНАМІКА <ArrowUpDown className="size-4" />
                      <SourceBadge source="ai" dark />
                    </span>
                  </th>
                  <th className="font-bold px-3 py-4">
                    <span className="inline-flex items-center gap-1.5">
                      ОСНОВНА ПРИЧИНА <SourceBadge source="ai" dark />
                    </span>
                  </th>
                  <th className="font-bold px-3 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      ЖУРНАЛ Д/З <SourceBadge source="data" dark />
                    </span>
                  </th>
                  <th className="font-bold px-5 py-4 rounded-tr-card text-right">ДІЇ</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data && (
                  <tr>
                    <td colSpan={6} className="p-6">
                      <Skeleton className="h-24 w-full" />
                    </td>
                  </tr>
                )}
                {allStudents.map((s) => <RiskRow key={s.studentId} s={s} />)}
                {data && allStudents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-500">
                      {data.noAnalysisYet
                        ? 'Аналізу станом на цю дату ще не було. Натисни «Зробити аналіз».'
                        : 'Немає проаналізованих студентів станом на цю дату.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="text-xs text-neutral-500 -mt-2">п.п. — процентні пункти</p>
      </div>
    </div>
  );
}

function RiskRow({ s }: { s: RiskStudent }) {
  return (
    <tr
      className={`border-b border-neutral-200 last:border-0 align-middle hover:bg-neutral-50/60 ${
        s.lost ? 'opacity-60 grayscale-[0.5]' : ''
      }`}
    >
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar seed={s.studentId} name={s.name} size={40} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] truncate">{s.name}</span>
              {s.lost && (
                <span
                  className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600"
                  title="Поза зоною впливу: немає логіну 60+ днів станом на обрану дату + AI оцінює як monitor/disengaged. Втручання вже малоефективне — це кейс для win-back / відрахування, не для термінового ризику."
                >
                  Поза впливом
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500 truncate">{s.email}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-4">
        <RiskGauge score={s.riskScore} level={s.riskLevel} />
      </td>
      <td className="px-3 py-4">
        <TrendDelta delta={s.riskDelta} prev={s.prevRiskScore} current={s.riskScore} />
      </td>
      <td className="px-3 py-4 max-w-[360px]">
        <ul className="space-y-1">
          {s.primaryDrivers.slice(0, 3).map((d, i) => (
            <li key={i} className="flex gap-2 text-xs text-ink">
              <span className="text-risk-high leading-5">•</span>
              <span className="leading-5">{d}</span>
            </li>
          ))}
          {s.primaryDrivers.length === 0 && <span className="text-xs text-neutral-400">—</span>}
        </ul>
      </td>
      <td className="px-3 py-4 text-center">
        <span
          className="inline-flex items-center gap-1.5 text-sm text-neutral-600"
          title="Пропущені Д/З"
        >
          <FileText className="size-4" />
          {s.missedHomework}
        </span>
      </td>
      <td className="px-5 py-4 text-right">
        <Link to={`/students/${s.studentId}`}>
          <Button className="text-sm">
            <ArrowRightCircle className="size-4" />
            Деталі
          </Button>
        </Link>
      </td>
    </tr>
  );
}
