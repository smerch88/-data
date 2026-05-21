import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeftCircle,
  Siren,
  MessageSquare,
  Search,
  Quote,
  LifeBuoy,
  History,
  X,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { DemoBar } from '@/components/DemoBar';
import { Avatar } from '@/components/Avatar';
import { RiskGauge } from '@/components/RiskGauge';
import { TrendDelta } from '@/components/TrendDelta';
import { LoginBars } from '@/components/LoginBars';
import { DraftMessageCard } from '@/components/DraftMessageCard';
import { Card } from '@/components/ui/card';
import { Badge, riskTone } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync } from '@/lib/useAsync';
import { api } from '@/lib/api';
import { useAsOf } from '@/lib/asOfContext';
import {
  label,
  riskLevelLabel,
  urgencyLabel,
  studentStateCaption,
  recommendedActionLabel,
} from '@/lib/labels';
import { daysAgoLabel } from '@/lib/utils';

export default function StudentProfile() {
  const { id = '' } = useParams();
  const { asOf, selectedRunId, setSelectedRunId } = useAsOf();
  const { data, loading, error } = useAsync(
    () => api.student(id, asOf, selectedRunId),
    [id, asOf, selectedRunId],
  );

  return (
    <div className="min-h-full">
      <DemoBar />
      <div className="mx-auto max-w-[1440px] px-10 py-10 flex flex-col gap-6">
        <Header />
        <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-brand">
          <ArrowLeftCircle className="size-5" />
          Назад до Dashboard
        </Link>

        {selectedRunId != null && (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-brand-200 bg-brand-50 px-5 py-3 text-sm">
            <History className="size-4 text-brand" />
            <span className="text-brand-dark">
              Перегляд історичного запуску аналізу — дані заморожені на той скан.
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

        {error && (
          <Card>
            <div className="p-6 text-risk-high">Не вдалося завантажити студента: {error}</div>
          </Card>
        )}
        {loading && !data && <Skeleton className="h-[320px] w-full rounded-card" />}

        {data && (
          <>
            {/* Top: identity + risk + AI recommendation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-brand-200">
                <div className="p-8 flex flex-col gap-7">
                  <div className="flex items-center gap-3">
                    <Avatar seed={data.student.id} name={data.student.name} size={60} />
                    <div>
                      <div className="text-2xl font-semibold tracking-tight">{data.student.name}</div>
                      <div className="text-xs text-neutral-500">{data.student.email}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
                    <span className="rounded-full px-3 py-1.5 bg-neutral-100">
                      {data.student.courseName}
                    </span>
                    <span className="rounded-full px-3 py-1.5 bg-neutral-100">
                      Модуль {data.activity.currentModule} з {data.activity.totalModules}
                    </span>
                    <span className="rounded-full px-3 py-1.5 bg-neutral-100">
                      Ментор: {data.student.mentorName}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-8 pt-2">
                    <div className="flex items-center gap-4 pr-8 border-r border-neutral-200">
                      <RiskGauge
                        score={data.analysis?.riskScore ?? null}
                        level={data.analysis?.riskLevel ?? null}
                        size={112}
                        stroke={10}
                      />
                      <div>
                        <div className="text-xs font-medium text-neutral-500">ПОКАЗНИК РИЗИКУ</div>
                        <div
                          className={`text-base font-bold ${
                            data.analysis?.riskLevel === 'high'
                              ? 'text-risk-high'
                              : data.analysis?.riskLevel === 'medium'
                                ? 'text-risk-medium'
                                : 'text-ok-dark'
                          }`}
                        >
                          {label(riskLevelLabel, data.analysis?.riskLevel)}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          Терміновість: {label(urgencyLabel, data.analysis?.urgency)}
                        </div>
                        <div className="mt-1">
                          <TrendDelta
                            delta={data.analysis?.riskDelta ?? null}
                            prev={data.analysis?.prevRiskScore}
                            current={data.analysis?.riskScore}
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-neutral-500">СТАН СТУДЕНТА (AI)</div>
                      <div className="text-base font-bold uppercase">
                        {data.analysis?.studentState ?? '—'}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {data.analysis?.studentState
                          ? label(studentStateCaption, data.analysis.studentState)
                          : 'Ще не проаналізовано'}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="bg-brand-100 border border-brand-200 relative overflow-hidden">
                <LifeBuoy className="absolute -right-10 top-10 size-60 text-white/40" strokeWidth={1} />
                <div className="p-8 relative flex flex-col gap-6 h-full">
                  <div className="flex items-center gap-2">
                    <Siren className="size-6 text-brand" />
                    <h3 className="text-xl font-bold text-brand">РЕКОМЕНДАЦІЇ AI</h3>
                  </div>
                  <div>
                    <p className="text-lg font-bold">
                      {label(recommendedActionLabel, data.analysis?.recommendedAction)}
                    </p>
                    <p className="text-neutral-700 mt-2 leading-6">
                      {data.analysis?.mentorSummary ?? 'Немає рекомендації — запусти аналіз.'}
                    </p>
                  </div>
                  <div className="flex gap-3 mt-auto">
                    <span className="rounded-md bg-white px-2.5 py-1.5 text-xs text-neutral-600">
                      Терміновість: {label(urgencyLabel, data.analysis?.urgency)}
                    </span>
                    {data.analysis?.priority && (
                      <span className="rounded-md bg-white px-2.5 py-1.5 text-xs text-neutral-600">
                        Пріоритет: {data.analysis.priority}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Activity + Draft message */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="p-8 flex flex-col gap-6">
                  <h3 className="text-lg font-bold">Активність</h3>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <Metric
                      label="ОСТАННІЙ LOGIN"
                      value={daysAgoLabel(data.activity.lastLoginDaysAgo)}
                      danger={(data.activity.lastLoginDaysAgo ?? 0) > 7}
                    />
                    <Metric
                      label="LOGINS (7 дн.)"
                      value={`${data.activity.loginsLast7d} раз`}
                      hint={`раніше: ${data.activity.loginsPrev7d}`}
                    />
                    <Metric label="ПРОГРЕС" value={`${data.activity.progressPct ?? 0}%`} hint={`${data.activity.currentModule}/${data.activity.totalModules} модулів`} />
                    <Metric
                      label="ДЗ ЗДАНО"
                      value={`${data.activity.hwSubmitted}/${data.activity.hwTotal}`}
                      hint={`${data.activity.hwMissed} пропущено`}
                      danger={data.activity.hwMissed > 0}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold mb-1">Логіни по днях</div>
                    <div className="text-xs text-neutral-500 mb-3">Останні ~4 тижні</div>
                    <LoginBars data={data.activity.loginsByDay} />
                  </div>
                </div>
              </Card>

              <DraftMessageCard
                key={`${data.student.id}:${selectedRunId ?? 'live'}`}
                draftMessage={data.analysis?.draftMessage ?? null}
              />
            </div>

            {/* AI insights + Slack quotes + Communication */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-6">
                <Card>
                  <div className="p-8">
                    <div className="flex items-center gap-2 mb-1">
                      <Search className="size-5 text-neutral-500" />
                      <h3 className="text-lg font-bold">Сигнали ризику (AI)</h3>
                    </div>
                    <p className="text-xs text-neutral-500 mb-4">
                      Драйвери ризику в порядку важливості (за оцінкою моделі)
                    </p>
                    <ul className="space-y-3">
                      {(data.analysis?.primaryDrivers ?? []).map((d, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="grid place-items-center size-6 shrink-0 rounded-full bg-risk-high/10 text-risk-high text-xs font-bold">
                            {i + 1}
                          </span>
                          <span className="text-sm leading-6">{d}</span>
                        </li>
                      ))}
                      {!data.analysis?.primaryDrivers?.length && (
                        <li className="text-sm text-neutral-400">Немає даних</li>
                      )}
                    </ul>
                  </div>
                </Card>
                <Card>
                  <div className="p-8">
                    <div className="flex items-center gap-2 mb-4">
                      <Quote className="size-5 text-neutral-500" />
                      <h3 className="text-lg font-bold">Ключові сигнали (докази AI)</h3>
                    </div>
                    <div className="space-y-3">
                      {data.communication.keyQuotes.map((q, i) => (
                        <div
                          key={i}
                          className="rounded-md border-l-4 border-risk-high bg-red-50 px-4 py-3 text-sm leading-6"
                        >
                          {q.text}
                        </div>
                      ))}
                      {data.communication.keyQuotes.length === 0 && (
                        <div className="text-sm text-neutral-400">Немає доказів</div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>

              <Card>
                <div className="p-8">
                  <div className="flex items-center gap-2 mb-5">
                    <MessageSquare className="size-5" />
                    <h3 className="text-lg font-bold">Комунікація</h3>
                  </div>
                  <div className="text-sm font-semibold mb-3">Останні повідомлення</div>
                  <div className="space-y-4">
                    {data.communication.recentMessages.map((m, i) => (
                      <div
                        key={i}
                        className={`border-l-2 pl-4 py-1 ${
                          m.from === 'student' ? 'border-risk-high' : 'border-neutral-400'
                        }`}
                      >
                        <div className="text-xs text-neutral-500 mb-1">
                          {m.from === 'student'
                            ? 'Від студента'
                            : m.from === 'mentor'
                              ? 'Від ментора'
                              : 'Від менеджера'}{' '}
                          · {m.channelType}
                        </div>
                        <div className="text-[15px] leading-6">{m.text}</div>
                      </div>
                    ))}
                    {data.communication.recentMessages.length === 0 && (
                      <div className="text-sm text-neutral-400">Немає повідомлень</div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            <div className="pb-4">
              <Badge tone={riskTone(data.analysis?.riskLevel)}>
                {data.analysis?.dashboardLabel ?? 'Без мітки'}
              </Badge>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      <div className={`text-lg font-bold ${danger ? 'text-risk-high' : 'text-ink'}`}>{value}</div>
      {hint && <div className="text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}
