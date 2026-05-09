// One-time helper: appends the project's ed25519 public key to the VPS's authorized_keys
// over a password-authenticated SSH session, so future operations can use key auth.
// Reads VPS_HOST, VPS_USER, VPS_PORT, VPS_PASSWORD from the repo-root .env.

import { Client } from 'ssh2';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');

function parseEnv(file) {
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = parseEnv(path.join(repoRoot, '.env'));
const host = env.VPS_HOST;
const user = env.VPS_USER;
const port = Number(env.VPS_PORT || 22);
const password = env.VPS_PASSWORD;

if (!host || !user || !password) {
  console.error('install.mjs: VPS_HOST / VPS_USER / VPS_PASSWORD must be set in .env');
  process.exit(2);
}

const pubkeyPath = path.join(os.homedir(), '.ssh', 'data_vps_id_ed25519.pub');
if (!fs.existsSync(pubkeyPath)) {
  console.error(`install.mjs: public key not found at ${pubkeyPath}`);
  console.error('Run bootstrap.sh first — it generates the keypair.');
  process.exit(3);
}
const pubkey = fs.readFileSync(pubkeyPath, 'utf8').trim();
const escaped = pubkey.replace(/'/g, "'\\''");

const remoteCmd =
  `umask 077 && mkdir -p ~/.ssh && touch ~/.ssh/authorized_keys && ` +
  `grep -qxF '${escaped}' ~/.ssh/authorized_keys || echo '${escaped}' >> ~/.ssh/authorized_keys && ` +
  `echo INSTALLED`;

const conn = new Client();
const timeout = setTimeout(() => {
  console.error('install.mjs: timed out');
  conn.end();
  process.exit(5);
}, 30_000);

conn
  .on('ready', () => {
    conn.exec(remoteCmd, (err, stream) => {
      if (err) {
        console.error('install.mjs: exec error:', err.message);
        conn.end();
        process.exit(6);
      }
      let stdout = '';
      let stderr = '';
      stream
        .on('close', (code) => {
          clearTimeout(timeout);
          conn.end();
          if (code === 0 && stdout.includes('INSTALLED')) {
            console.log(`✓ Key installed on ${user}@${host}`);
            process.exit(0);
          }
          console.error(`✗ Remote command failed (exit ${code})`);
          if (stderr) console.error(stderr.trim());
          process.exit(7);
        })
        .on('data', (d) => { stdout += d.toString(); })
        .stderr.on('data', (d) => { stderr += d.toString(); });
    });
  })
  .on('error', (err) => {
    clearTimeout(timeout);
    console.error('install.mjs: connection error:', err.message);
    process.exit(8);
  })
  .connect({
    host,
    port,
    username: user,
    password,
    readyTimeout: 15_000,
  });
