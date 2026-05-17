// Typed client for the Express /analysis BFF. Types mirror the verified
// response shape 1:1 (camelCase, as the backend maps it).

const BASE = '/api'; // Vite proxies /api → Express (see vite.config.ts)

export type RiskLevel = 'high' | 'medium' | 'low';

export interface Course {
  id: string;
  name: string;
  totalModules: number;
  durationWeeks: number;
  format: string;
  startDate: string | null; // 'YYYY-MM-DD' — earliest course deadline
  endDate: string | null; // 'YYYY-MM-DD' — latest course deadline
  milestones: { label: string; date: string }[];
  deadlines: {
    hwId: string;
    title: string | null;
    topic: string | null;
    module: number | null;
    date: string;
    isExam: boolean;
  }[];
}

export interface ScanMeta {
  lastAnalyzedAt: string | null;
  analyzedCount: number;
  totalStudents: number;
  hasPrevious: boolean;
  previousSnapshotAt: string | null;
}

interface StatValue {
  value: number;
  total?: number;
  pct?: number | null;
  deltaVsPrev?: number | null;
}

export interface OverviewStats {
  activeStudents: StatValue;
  dropped: StatValue;
  hwSubmitted: StatValue;
  hwMissedTotal: StatValue;
  hwNotSubmitted: StatValue;
  atRisk: StatValue;
  exam: {
    deadline: string | null;
    due: boolean;
    submitted: number;
    graded: number;
    total: number;
  };
}

export interface RiskStudent {
  studentId: string;
  name: string;
  email: string;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  urgency: string | null;
  studentState: string | null;
  dashboardLabel: string | null;
  primaryDrivers: string[];
  prevRiskScore: number | null;
  riskDelta: number | null;
  missedHomework: number;
  /** Effectively dropped per our signals (60d+ no login as-of AND AI says
   * monitor/disengaged) — outside the zone of influence; shown muted, last. */
  lost: boolean;
}

export interface SelectedRun {
  id: number;
  asOfDate: string;
  triggeredAt: string;
  status: string;
  /** true = auto-resolved live run (latest complete ≤ demo date), NOT an
   * explicit historical pick. Don't show the "historical" banner for these. */
  auto?: boolean;
}

export interface Overview {
  course: Course;
  scan: ScanMeta;
  stats: OverviewStats;
  riskStudents: RiskStudent[];
  selectedRun: SelectedRun | null;
  /** No completed run exists on/before the demo date — AI layer is empty. */
  noAnalysisYet?: boolean;
}

export type RunStatus = 'running' | 'complete' | 'failed';

export interface AnalysisRun {
  id: number;
  asOfDate: string;
  triggeredAt: string;
  finalizedAt: string | null;
  status: RunStatus;
  total: number;
  high: number;
  medium: number;
  low: number;
}

export interface StudentAnalysis {
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  urgency: string | null;
  recommendedAction: string | null;
  secondaryAction: string | null;
  priority: string | null;
  studentState: string | null;
  primaryDrivers: string[];
  supportingEvidence: string[];
  draftMessage: string | null;
  mentorSummary: string | null;
  dashboardLabel: string | null;
  analyzedAt: string | null;
  prevRiskScore: number | null;
  riskDelta: number | null;
}

export interface StudentDetail {
  noAnalysisYet?: boolean;
  student: {
    id: string;
    name: string;
    email: string;
    slackId: string;
    status: string;
    currentModule: number;
    enrollmentDate: string;
    courseName: string;
    mentorName: string;
  };
  analysis: StudentAnalysis | null;
  activity: {
    lastLoginDate: string | null;
    lastLoginDaysAgo: number | null;
    loginsLast7d: number;
    loginsPrev7d: number;
    loginsByDay: { date: string; clicks: number }[];
    progressPct: number | null;
    currentModule: number;
    totalModules: number;
    hwSubmitted: number;
    hwTotal: number;
    hwMissed: number;
  };
  communication: {
    recentMessages: {
      from: 'student' | 'mentor' | 'manager';
      text: string;
      sentAt: string;
      channelType: string;
    }[];
    keyQuotes: { text: string }[];
  };
}

export interface ScanState {
  totalStudents: number;
  analyzedCount: number;
  lastAnalyzedAt: string | null;
  progressPct: number | null;
  inProgress: boolean;
  justCompleted: boolean;
  /** Rows analyzed for the IN-FLIGHT run only (analyzed_at ≥ its
   * triggered_at) — the real progress, vs analyzedCount which can be stale
   * rows from a previous run. null when no run is in flight. */
  freshCount: number | null;
  /** Run is 'running' but produced zero fresh rows past the startup grace
   * → n8n is dead/not processing it (it will hard-fail at the watchdog). */
  stalled: boolean;
  /** Status of the most recent run by triggered_at — lets the button show
   * "failed" instead of a false "completed ✓". */
  runStatus: RunStatus | null;
  runTriggeredAt: string | null;
}

export interface ScanTriggerResult {
  archived: number;
  triggered: boolean;
  /** 409: a scan is already running — attach to it, don't error. */
  blocked?: boolean;
  runningRunId?: number;
  asOfDate?: string;
  error?: string;
  n8n?: { status: number; body: unknown };
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} on ${path}`);
  return r.json() as Promise<T>;
}

/** Tunable constants for the deterministic data cards (sent as query
 * params; the backend clamps + defaults them). */
export interface CalcParams {
  activeWindowDays: number;
  inactiveDays: number;
  examPassMark: number;
}

function qs(asOf?: string, runId?: number | null, calc?: CalcParams): string {
  const p = new URLSearchParams();
  if (asOf) p.set('asOf', asOf);
  if (runId != null) p.set('runId', String(runId));
  if (calc) {
    p.set('aw', String(calc.activeWindowDays));
    p.set('ia', String(calc.inactiveDays));
    p.set('ep', String(calc.examPassMark));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const api = {
  overview: (asOf?: string, runId?: number | null, calc?: CalcParams) =>
    get<Overview>(`/analysis/overview${qs(asOf, runId, calc)}`),
  student: (id: string, asOf?: string, runId?: number | null) =>
    get<StudentDetail>(`/analysis/students/${encodeURIComponent(id)}${qs(asOf, runId)}`),
  runs: () => get<{ runs: AnalysisRun[] }>('/analysis/runs'),
  scanState: () => get<ScanState>('/analysis/scan/state'),
  triggerScan: async (asOfDate = '2025-08-21'): Promise<ScanTriggerResult> => {
    const r = await fetch(`${BASE}/analysis/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ asOfDate }),
    });
    return r.json() as Promise<ScanTriggerResult>;
  },
  deleteRun: async (id: number): Promise<{ deleted: boolean; id: number; error?: string }> => {
    const r = await fetch(`${BASE}/analysis/runs/${id}`, { method: 'DELETE' });
    return r.json() as Promise<{ deleted: boolean; id: number; error?: string }>;
  },
};
