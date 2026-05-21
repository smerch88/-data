#!/usr/bin/env node
/**
 * Per-run LLM cost tracker for the AI risk-analysis pipeline.
 *
 * WHAT IT DOES
 *   Reads n8n's event log (the REAL Anthropic token usage of every LLM call)
 *   and the `analysis_run` table, then attributes each call to the run whose
 *   [triggered_at, finalized_at] window contains it. Runs never overlap —
 *   POST /analysis/scan blocks concurrent runs with HTTP 409 — so the
 *   timestamp window is an unambiguous key. Prints a per-run USD cost report
 *   and appends it to infra/n8n/logs/run-costs.log.
 *
 * USAGE
 *   node infra/n8n/run-cost.mjs           # local — needs the docker stack up
 *   (on the VPS: cd /opt/-data && node infra/n8n/run-cost.mjs)
 *
 * PRICING
 *   Every sub-agent runs Claude Sonnet 4.5 — $3 / 1M input, $15 / 1M output.
 *   Update RATE_IN / RATE_OUT below if the model or Anthropic pricing changes.
 *
 * Token usage is what n8n logs as `n8n.ai.llm.generated` events; failed calls
 * (`n8n.ai.llm.error`) cost nothing and are intentionally not counted.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RATE_IN = 3 / 1_000_000; // USD per input token  — Claude Sonnet 4.5
const RATE_OUT = 15 / 1_000_000; // USD per output token — Claude Sonnet 4.5
const MODEL = 'claude-sonnet-4-5';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const run = (cmd) =>
  execSync(cmd, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });

function fail(msg) {
  console.error(`\nrun-cost: ${msg}\n`);
  process.exit(1);
}

// ── 1. analysis_run rows (id + time window + bookkeeping) ───────────────────
let runsRaw;
try {
  runsRaw = run(
    'docker compose exec -T postgres psql -U app -d appdb -At -F"|" -c ' +
      '"SELECT id, as_of_date, extract(epoch from triggered_at), ' +
      'extract(epoch from COALESCE(finalized_at, now())), status, total_count ' +
      'FROM analysis_run ORDER BY triggered_at;"',
  );
} catch (e) {
  fail('cannot read analysis_run — is the postgres container up?\n' + e.message);
}

const runs = runsRaw
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [id, asOf, start, end, status, total] = line.split('|');
    return {
      id: Number(id),
      asOf,
      start: Number(start),
      end: Number(end),
      status,
      total: Number(total),
      calls: 0,
      inTok: 0,
      outTok: 0,
    };
  });

if (runs.length === 0) fail('no rows in analysis_run — nothing to cost.');

// ── 2. n8n event log → successful LLM token-usage events ────────────────────
let logRaw;
try {
  logRaw = run(
    'docker compose exec -T n8n sh -c "cat /home/node/.n8n/n8nEventLog*.log"',
  );
} catch (e) {
  fail('cannot read the n8n event log — is the n8n container up?\n' + e.message);
}

const seen = new Set(); // dedupe by event id — rotated log files can overlap
const unattributed = { calls: 0, inTok: 0, outTok: 0 };
let totalCalls = 0;

for (const line of logRaw.split(/\r?\n/)) {
  if (!line.includes('n8n.ai.llm.generated')) continue;

  const idM = line.match(/"id":"([^"]+)"/);
  if (idM) {
    if (seen.has(idM[1])) continue;
    seen.add(idM[1]);
  }

  const tsM = line.match(/"ts":"([^"]+)"/);
  const inM = line.match(/promptTokens\D+?(\d+)/);
  const outM = line.match(/completionTokens\D+?(\d+)/);
  if (!tsM || !inM || !outM) continue;

  const epoch = Date.parse(tsM[1]) / 1000;
  totalCalls++;

  // runs never overlap → at most one window contains this call
  const bucket = runs.find((r) => epoch >= r.start && epoch <= r.end) ?? unattributed;
  bucket.calls++;
  bucket.inTok += Number(inM[1]);
  bucket.outTok += Number(outM[1]);
}

// ── 3. build the report ─────────────────────────────────────────────────────
const usd = (n) => '$' + n.toFixed(4);
const cost = (b) => b.inTok * RATE_IN + b.outTok * RATE_OUT;
const num = (x) => x.toLocaleString('en-US');
const WIDTHS = [6, 12, 14, 7, 11, 11, 11, 12];
const row = (cells) => cells.map((c, i) => String(c).padEnd(WIDTHS[i])).join('');

const lines = [];
lines.push(`LLM cost per analysis run — model ${MODEL} ($3/1M in, $15/1M out)`);
lines.push(`generated at ${new Date().toISOString()}`);
lines.push('');
lines.push(row(['RUN', 'AS-OF', 'STATUS', 'CALLS', 'IN-TOK', 'OUT-TOK', 'COST', 'PER-STUDENT']));
lines.push('-'.repeat(WIDTHS.reduce((a, b) => a + b, 0)));

for (const r of runs) {
  const c = cost(r);
  lines.push(
    row([
      `#${r.id}`,
      r.asOf,
      r.status,
      r.calls,
      num(r.inTok),
      num(r.outTok),
      usd(c),
      r.total > 0 ? usd(c / r.total) : '—',
    ]),
  );
}

if (unattributed.calls > 0) {
  lines.push(
    row([
      '—',
      '(no run)',
      'unattributed',
      unattributed.calls,
      num(unattributed.inTok),
      num(unattributed.outTok),
      usd(cost(unattributed)),
      '',
    ]),
  );
}

const grandIn = runs.reduce((s, r) => s + r.inTok, 0) + unattributed.inTok;
const grandOut = runs.reduce((s, r) => s + r.outTok, 0) + unattributed.outTok;
lines.push('-'.repeat(WIDTHS.reduce((a, b) => a + b, 0)));
lines.push(
  row([
    'ALL',
    '',
    '',
    totalCalls,
    num(grandIn),
    num(grandOut),
    usd(grandIn * RATE_IN + grandOut * RATE_OUT),
    '',
  ]),
);

const costed = runs.filter((r) => r.status === 'complete' && r.calls > 0);
if (costed.length > 0) {
  const avg = costed.reduce((s, r) => s + cost(r), 0) / costed.length;
  lines.push('');
  lines.push(
    `avg cost of a completed run: ${usd(avg)} ` +
      `(over ${costed.length} completed run(s) that carry token data)`,
  );
}
if (unattributed.calls > 0) {
  lines.push(
    `note: ${unattributed.calls} call(s) fell outside every run window ` +
      `(manual/test executions, or runs whose row was deleted) — see "unattributed".`,
  );
}

const report = lines.join('\n');
console.log('\n' + report + '\n');

// ── 4. append to the cost log ───────────────────────────────────────────────
const logDir = join(repoRoot, 'infra', 'n8n', 'logs');
mkdirSync(logDir, { recursive: true });
appendFileSync(
  join(logDir, 'run-costs.log'),
  '\n' + '='.repeat(WIDTHS.reduce((a, b) => a + b, 0)) + '\n' + report + '\n',
);
console.log('appended → infra/n8n/logs/run-costs.log\n');
