#!/usr/bin/env bash
# Idempotent n8n bootstrap — identical locally and on the VPS.
#
# Brings up the stack, then loads the 8 workflows + 2 credentials purely
# from version-controlled files. No secret is in any of those files: the
# credentials template uses {{ $env.X }} expressions, the real values come
# from the container env (docker-compose reads repo-root .env).
#
# The ONLY by-hand prerequisite is a filled .env:
#   local : ANTHROPIC_API_KEY (optional; only if you run the AI agents)
#   VPS   : ANTHROPIC_API_KEY, N8N_ENCRYPTION_KEY, N8N_HOST/PROTOCOL/PUBLIC_URL,
#           BIND_HOST=127.0.0.1   (+ DNS A-record + Caddy — see README.md)
#
# Usage:
#   bash infra/n8n/bootstrap.sh            # up + import + activate
#   bash infra/n8n/bootstrap.sh --smoke    # also POST /webhook/planner/batch
#
# Re-running is safe: import:* upserts by stable id, activation/restart are
# idempotent.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

# docker compose v2 ("docker compose") with v1 fallback ("docker-compose").
if docker compose version >/dev/null 2>&1; then
  dc() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
  dc() { docker-compose "$@"; }
else
  echo "bootstrap: docker compose not found" >&2
  exit 1
fi

wait_healthz() {
  # n8n returns 200 on GET /healthz once the server is ready.
  local tries=0 max=60
  printf 'bootstrap: waiting for n8n /healthz'
  until dc exec -T n8n node -e \
      "require('http').get('http://127.0.0.1:5678/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" \
      >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -ge "$max" ]; then
      echo " — timed out after $((max * 2))s" >&2
      dc logs --tail=40 n8n >&2 || true
      exit 1
    fi
    printf '.'
    sleep 2
  done
  echo " ok"
}

echo "bootstrap: bringing up the stack (postgres + pgadmin + n8n)…"
dc up -d

wait_healthz

echo "bootstrap: importing credentials (2: Postgres account, Anthropic account)…"
dc exec -T n8n n8n import:credentials --input=/import/credentials.json

echo "bootstrap: importing workflows (8, from n8n/workflows/)…"
dc exec -T n8n n8n import:workflow --separate --input=/import/workflows

# Activate every imported workflow. Modern n8n removed `update:workflow --all`
# and `publish:workflow --all`; activation is now per-id via publish:workflow.
# (import:workflow deactivates on import, so this step is required.)
echo "bootstrap: activating workflows (publish each by id)…"
wf_ids="$(dc exec -T n8n n8n list:workflow --onlyId | tr -d '\r' | grep -E '^[A-Za-z0-9_-]+$' || true)"
if [ -z "$wf_ids" ]; then
  echo "bootstrap: list:workflow returned no ids — nothing to activate" >&2
  exit 1
fi
for wf_id in $wf_ids; do
  echo "  publish:workflow --id=$wf_id"
  dc exec -T n8n n8n publish:workflow --id="$wf_id"
done

# The running server registers production webhooks on (re)start, so restart
# once after activation — otherwise /webhook/* 404s until the next restart.
echo "bootstrap: restarting n8n to register webhooks…"
dc restart n8n
wait_healthz

echo
echo "bootstrap: done. Workflows are active. Trigger the batch with:"
echo "  curl -s -X POST <base>/webhook/planner/batch \\"
echo "       -H 'content-type: application/json' \\"
echo "       -d '{\"trigger\":\"force\",\"as_of_date\":\"2025-08-21\"}'"
echo "  (<base> = http://localhost:5678 locally, https://n8n.<domain> on VPS)"

if [ "${1:-}" = "--smoke" ]; then
  as_of="${2:-2025-08-21}"
  echo
  echo "bootstrap: smoke POST /webhook/planner/batch (as_of_date=$as_of)…"
  # n8n /healthz can turn green a second or two BEFORE active-workflow webhooks
  # finish registering after the restart above, so the production webhook
  # briefly 404s ("unknown webhook" then "Activated workflow" in the logs).
  # Retry until it is registered (2xx) or give up. The node script prints the
  # status code to stdout (captured) and the human-readable line to stderr.
  smoke_ok=0
  for attempt in $(seq 1 15); do
    code="$(dc exec -T n8n node -e "
      const http=require('http');
      const body=JSON.stringify({trigger:'force',as_of_date:'$as_of'});
      const req=http.request('http://127.0.0.1:5678/webhook/planner/batch',
        {method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},
        r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{process.stderr.write('HTTP '+r.statusCode+' '+d.slice(0,200)+'\n');process.stdout.write(String(r.statusCode));});});
      req.on('error',e=>{process.stderr.write(e.message+'\n');process.stdout.write('000');});
      req.end(body);
    ")"
    if [ "${code:-000}" -ge 200 ] 2>/dev/null && [ "${code:-000}" -lt 400 ] 2>/dev/null; then
      smoke_ok=1
      echo "bootstrap: smoke OK (HTTP $code) — batch is processing async (~4-7 min for 15 students)."
      break
    fi
    echo "bootstrap: smoke attempt $attempt/15 got HTTP ${code:-?} (webhook not ready yet) — retrying in 4s…"
    sleep 4
  done
  if [ "$smoke_ok" -ne 1 ]; then
    echo "bootstrap: smoke FAILED after retries (last HTTP ${code:-?}). Check 'docker compose logs n8n'." >&2
    exit 1
  fi
fi
