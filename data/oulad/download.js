#!/usr/bin/env node
/**
 * Download + extract the Open University Learning Analytics Dataset (OULAD).
 *
 * Source: Kuzilek J., Hlosta M., Zdrahal Z. (2017). OULAD.
 *   figshare DOI 10.6084/m9.figshare.5081998 — CC BY 4.0.
 *
 * Idempotent:
 *  - Skips re-download if all 7 CSVs are already extracted.
 *  - Verifies MD5 of the downloaded ZIP before unpacking.
 *
 * Cross-platform unzip:
 *  - Tries `unzip` (POSIX, Git Bash, WSL).
 *  - Falls back to PowerShell `Expand-Archive` (Windows).
 *
 * After extraction, run `node data/oulad/sample.js` to produce sample.json.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const FIGSHARE_URL = 'https://ndownloader.figshare.com/files/8606371';
const EXPECTED_MD5 = '7412686fd77cf0e0ee1e8c3e9b354308';
const ROOT = __dirname;
const ZIP_PATH = path.join(ROOT, 'anonymisedData.zip');
const REQUIRED_CSVS = [
  'studentInfo.csv',
  'studentRegistration.csv',
  'studentAssessment.csv',
  'studentVle.csv',
  'courses.csv',
  'assessments.csv',
  'vle.csv',
];

function allExtracted() {
  return REQUIRED_CSVS.every((f) => fs.existsSync(path.join(ROOT, f)));
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    function go(currentUrl, hops) {
      if (hops > 5) return reject(new Error('Too many redirects'));
      https
        .get(currentUrl, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume();
            return go(res.headers.location, hops + 1);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} for ${currentUrl}`));
          }
          const total = parseInt(res.headers['content-length'] || '0', 10);
          let downloaded = 0;
          res.on('data', (chunk) => {
            downloaded += chunk.length;
            if (total) {
              const pct = ((downloaded / total) * 100).toFixed(1);
              process.stdout.write(
                `\r  ${(downloaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB (${pct}%)`,
              );
            }
          });
          res.pipe(out);
          out.on('finish', () => {
            out.close();
            console.log();
            resolve();
          });
          out.on('error', reject);
        })
        .on('error', reject);
    }
    go(url, 0);
  });
}

function unzipPosix() {
  execSync(`unzip -o "${ZIP_PATH}" -d "${ROOT}"`, { stdio: 'inherit' });
}

function unzipPowerShell() {
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Force -Path '${ZIP_PATH}' -DestinationPath '${ROOT}'"`,
    { stdio: 'inherit' },
  );
}

function extract() {
  console.log('Extracting ...');
  try {
    unzipPosix();
  } catch (e) {
    console.log('  `unzip` not available — falling back to PowerShell.');
    unzipPowerShell();
  }
}

async function main() {
  if (allExtracted()) {
    console.log('OULAD CSVs already extracted in', ROOT);
    console.log('Run `node data/oulad/sample.js` to (re)generate sample.json.');
    return;
  }

  const haveValidZip =
    fs.existsSync(ZIP_PATH) && md5(ZIP_PATH) === EXPECTED_MD5;

  if (!haveValidZip) {
    if (fs.existsSync(ZIP_PATH)) {
      console.log('Existing ZIP MD5 mismatch, re-downloading.');
      fs.unlinkSync(ZIP_PATH);
    }
    console.log(`Downloading ${FIGSHARE_URL} → ${ZIP_PATH}`);
    await download(FIGSHARE_URL, ZIP_PATH);
    const got = md5(ZIP_PATH);
    if (got !== EXPECTED_MD5) {
      throw new Error(`MD5 mismatch after download: got ${got}, expected ${EXPECTED_MD5}`);
    }
    console.log('MD5 verified:', got);
  } else {
    console.log('Found valid ZIP at', ZIP_PATH);
  }

  extract();

  if (!allExtracted()) {
    throw new Error('Extraction finished but required CSVs are missing');
  }
  console.log('OK — OULAD ready.');
  console.log('Next: `node data/oulad/sample.js` to generate sample.json,');
  console.log('then `cd backend && npm run seed:run` to load into Postgres.');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
