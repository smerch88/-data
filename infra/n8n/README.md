# n8n — deploy runbook (local + VPS)

n8n runs as a service in the repo's `docker-compose.yml` (`app-n8n`), on the
same Docker network as Postgres, behind Caddy on its own subdomain in prod.
The 8 workflows live in [`n8n/workflows/`](../../n8n/workflows/); their
inter-workflow HTTP nodes point at `http://localhost:5678/webhook/*` (n8n
calling itself inside the container — correct regardless of the public URL).

**Everything except secrets and DNS is scripted.** `bootstrap.sh` brings the
stack up and loads the 8 workflows + 2 credentials from version-controlled
files. No secret is in any of those files — `credentials.template.json` uses
`{{ $env.X }}` expressions; the real values come from the container env
(docker-compose reads repo-root `.env`).

The credential **objects** can't be born from env alone (n8n Community has no
External Secrets), so they are seeded once via `n8n import:credentials` — that
is what `bootstrap.sh` automates. Credential IDs are normalized across all
workflows to two stable IDs (`PgAcctFixed00001`, `AnthropicAcct001`) matching
`credentials.template.json`, so binding is automatic on import — zero clicks.

## The only by-hand steps (irreducible — secrets + DNS)

| | Local | VPS |
|---|---|---|
| Fill repo-root `.env` | `ANTHROPIC_API_KEY` (optional, only for AI agents) | all of §VPS `.env` below |
| DNS A-record | — | `n8n.<domain>` → VPS IP |
| Caddy `/etc` deploy | — | §Caddy below (scripted, but root) |

Everything else = `bash infra/n8n/bootstrap.sh`.

## Local

```
# (optional) echo ANTHROPIC_API_KEY=sk-ant-... >> .env
bash infra/n8n/bootstrap.sh --smoke
```

That brings up the stack, imports + activates all 8 workflows, binds both
credentials, restarts n8n to register webhooks, and POSTs a smoke
`/webhook/planner/batch`. Editor (if you want it): http://localhost:5678 —
not required to run; webhooks fire without an owner account / UI login.

Locally **do not set `N8N_ENCRYPTION_KEY`** in `.env` — the compose default is
a fixed dev string, so credentials survive restarts. Setting a real key only
matters on the VPS (where no credentials exist yet).

## VPS

### 1. `.env` (in `/opt/-data/.env`, not committed)

```
BIND_HOST=127.0.0.1
N8N_HOST=n8n.<domain>
N8N_PROTOCOL=https
N8N_PUBLIC_URL=https://n8n.<domain>
N8N_PORT=5678
N8N_ENCRYPTION_KEY=<openssl rand -hex 32>     # set BEFORE first bootstrap; never change after
TZ=Europe/Kyiv
ANTHROPIC_API_KEY=<team key>
```

`POSTGRES_*` already present from the existing stack are reused by n8n.

### 2. Bootstrap

```
cd /opt/-data && git pull
bash infra/n8n/bootstrap.sh
```

n8n binds `127.0.0.1:5678` (because `BIND_HOST=127.0.0.1`) — reachable only
via Caddy, not from the internet directly.

### 3. Caddy (one-time, root)

```
sudo cp infra/caddy/Caddyfile.example /etc/caddy/Caddyfile
sudo sed -i "s/__DOMAIN__/db.<domain>/"      /etc/caddy/Caddyfile
sudo sed -i "s/__N8N_DOMAIN__/n8n.<domain>/" /etc/caddy/Caddyfile
sudo sed -i "s/__EMAIL__/<le-email>/"        /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -I https://n8n.<domain>      # expect 200/302 from n8n
```

DNS prerequisite: the `n8n.<domain>` A-record must already point at the VPS,
or Caddy's Let's Encrypt challenge for that host fails.

### 4. Verify

```
curl -s -X POST https://n8n.<domain>/webhook/planner/batch \
  -H 'content-type: application/json' \
  -d '{"trigger":"force","as_of_date":"2025-08-21"}'
# expect: {"status":"processing", ...} (202), results land in analysis_results
```

`as_of_date=2025-08-21` is the demo anchor after the 2025 seed re-anchor — the
exact +4116-day image of the original `2014-05-15` OULAD mid-window date, so
the same personas stay at-risk. It is also the hardcoded fallback baked into
the workflow JSONs, so omitting `as_of_date` works too.

## Notes / gotchas

- **Encryption key is load-bearing.** Change `N8N_ENCRYPTION_KEY` after
  credentials exist → all credentials become undecryptable; rerun bootstrap
  after wiping the `n8n-data` volume. Set it once, before the first bootstrap.
- `bootstrap.sh` is idempotent: `import:*` upserts by stable id, activation +
  restart are repeatable. Safe to rerun after `git pull`.
- n8n state (workflows, credentials, executions) is SQLite in the `n8n-data`
  named volume — survives `up/down`, wiped only by `down -v`.
- Credential values are env expressions. To rotate a secret: edit `.env` →
  `docker compose up -d n8n` (no re-import, no UI).
- WF8 batch takes ~4-7 min for 15 students; Caddy `read_timeout` is 600s. The
  webhook returns `202` immediately and processes async.
- If `{{ $env.X }}` resolves empty inside a credential, check that
  `N8N_BLOCK_ENV_ACCESS_IN_NODE` is not `true` (we leave it unset = allowed).
