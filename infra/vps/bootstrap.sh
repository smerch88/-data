#!/usr/bin/env bash
# One-time setup: generate a project-local SSH key and install it on the VPS.
# After this succeeds, infra/vps/vps-run.sh works without prompting for a password.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

if [[ ! -f .env ]]; then
  echo "bootstrap: .env not found in repo root ($repo_root)" >&2
  exit 2
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

: "${VPS_HOST:?VPS_HOST not set in .env}"
: "${VPS_USER:?VPS_USER not set in .env}"
VPS_PORT="${VPS_PORT:-22}"

mkdir -p "${HOME}/.ssh"
key="${HOME}/.ssh/data_vps_id_ed25519"

if [[ ! -f "$key" ]]; then
  echo "→ Generating new ed25519 key at $key"
  ssh-keygen -t ed25519 -N "" -f "$key" -C "data-repo $(date +%F)" >/dev/null
fi

# If key already works, we're done.
if ssh -i "$key" -o BatchMode=yes -o ConnectTimeout=5 \
     -o StrictHostKeyChecking=accept-new \
     -p "$VPS_PORT" "${VPS_USER}@${VPS_HOST}" 'true' >/dev/null 2>&1; then
  echo "✓ Key already authorized on ${VPS_USER}@${VPS_HOST}"
  exit 0
fi

pubkey="$(cat "${key}.pub")"

if command -v sshpass >/dev/null 2>&1 && [[ -n "${VPS_PASSWORD:-}" ]]; then
  echo "→ Installing key via sshpass..."
  sshpass -p "$VPS_PASSWORD" ssh \
    -o StrictHostKeyChecking=accept-new \
    -o PreferredAuthentications=password \
    -o PubkeyAuthentication=no \
    -p "$VPS_PORT" \
    "${VPS_USER}@${VPS_HOST}" \
    "umask 077; mkdir -p ~/.ssh && touch ~/.ssh/authorized_keys && grep -qxF '$pubkey' ~/.ssh/authorized_keys || echo '$pubkey' >> ~/.ssh/authorized_keys"
  echo "✓ Key installed."
elif command -v node >/dev/null 2>&1 && [[ -n "${VPS_PASSWORD:-}" ]]; then
  echo "→ sshpass not found; installing via Node ssh2 helper..."
  helper="$repo_root/infra/vps/install-key"
  if [[ ! -d "$helper/node_modules" ]]; then
    echo "  installing ssh2 dependency (one-time)..."
    (cd "$helper" && npm install --silent --no-audit --no-fund)
  fi
  (cd "$helper" && node install.mjs)
else
  cat <<EOF >&2

✗ Cannot install the key automatically (neither sshpass nor node found, or VPS_PASSWORD missing).

Run this ONE-LINER manually (Git Bash or PowerShell with OpenSSH).
It will prompt for the VPS password — find it in .env (VPS_PASSWORD).

  ssh -p $VPS_PORT -o StrictHostKeyChecking=accept-new ${VPS_USER}@${VPS_HOST} \\
    "umask 077; mkdir -p ~/.ssh && echo '$pubkey' >> ~/.ssh/authorized_keys"

Then re-run this script to verify.

EOF
  exit 4
fi

# Verify key now works
if ssh -i "$key" -o BatchMode=yes -o ConnectTimeout=5 \
     -o StrictHostKeyChecking=accept-new \
     -p "$VPS_PORT" "${VPS_USER}@${VPS_HOST}" 'true' >/dev/null 2>&1; then
  echo "✓ Verified: key auth works on ${VPS_USER}@${VPS_HOST}"
  exit 0
else
  echo "✗ Verification failed — key did not authorize." >&2
  exit 5
fi
