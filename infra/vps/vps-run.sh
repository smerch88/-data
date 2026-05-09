#!/usr/bin/env bash
# Run a command on the VPS over SSH using the project's key.
# Usage: ./infra/vps/vps-run.sh "<remote command and args>"
# Reads VPS_HOST, VPS_USER, VPS_PORT from repo-root .env.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

if [[ ! -f .env ]]; then
  echo "vps-run: .env not found in repo root ($repo_root)" >&2
  exit 2
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

: "${VPS_HOST:?VPS_HOST not set in .env}"
: "${VPS_USER:?VPS_USER not set in .env}"
VPS_PORT="${VPS_PORT:-22}"

key="${HOME}/.ssh/data_vps_id_ed25519"
if [[ ! -f "$key" ]]; then
  echo "vps-run: ssh key not found at $key" >&2
  echo "         run /vps-bootstrap (or: bash infra/vps/bootstrap.sh) first." >&2
  exit 3
fi

if [[ $# -eq 0 ]]; then
  echo "vps-run: no command provided" >&2
  echo "usage: $0 \"<remote command>\"" >&2
  exit 64
fi

exec ssh \
  -i "$key" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=accept-new \
  -o ServerAliveInterval=30 \
  -p "$VPS_PORT" \
  "${VPS_USER}@${VPS_HOST}" \
  "$@"
