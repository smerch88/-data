#!/usr/bin/env node
/**
 * Usage:
 *   node screenshot.js --url <url> --out <path> [--selector <css>] [--wait <ms>] [--full] [--width N] [--height N] [--text-out <path>]
 *
 * Examples:
 *   node screenshot.js --url https://www.anthropic.com/pricing --out ../../docs/proofs/claude-pricing/screenshot.png --text-out ../../docs/proofs/claude-pricing/text.md --full
 *   node screenshot.js --url https://www.pinecone.io/pricing/ --out shot.png --selector "main" --wait 3000
 *
 * If --text-out is given, also dumps the rendered text content of the page (or the selector,
 * if --selector is given) — useful as a textual fallback when the screenshot misses something.
 * Convention: text-out should be a .md file (e.g. text.md) so it renders nicely on GitHub.
 */
const { chromium } = require('patchright');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

async function run() {
  const args = parseArgs(process.argv);
  if (!args.url || !args.out) {
    console.error('Missing --url or --out');
    process.exit(2);
  }

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const waitMs = parseInt(args.wait || '2000', 10);

  // Patchright stealth recommendations: launchPersistentContext + Chrome channel,
  // no custom userAgent, no explicit viewport, no headless flag.
  // See https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-nodejs
  const userDataDir = path.join(
    require('os').tmpdir(),
    `patchright-profile-${Date.now()}`,
  );
  fs.mkdirSync(userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: true,
    viewport: null,
  });
  const page = context.pages()[0] || (await context.newPage());

  console.error(`[shot] navigating to ${args.url}`);
  try {
    await page.goto(args.url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    console.error(`[shot] networkidle timeout, falling back to domcontentloaded: ${e.message}`);
    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  }

  if (args.selector && typeof args.selector === 'string') {
    try {
      await page.waitForSelector(args.selector, { timeout: 10000 });
    } catch (e) {
      console.error(`[shot] selector "${args.selector}" not found within 10s — continuing anyway`);
    }
  }

  // Dismiss obvious cookie banners by trying common buttons.
  const cookieSelectors = [
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("I agree")',
    'button:has-text("Got it")',
    'button:has-text("OK")',
    'button#onetrust-accept-btn-handler',
    'button[aria-label="Accept all"]',
  ];
  for (const sel of cookieSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
        break;
      }
    } catch {}
  }

  await page.waitForTimeout(waitMs);

  const shotOpts = {
    path: outPath,
    fullPage: !!args.full && args.selector === undefined,
  };

  if (args.selector && typeof args.selector === 'string') {
    const el = await page.$(args.selector);
    if (el) {
      await el.screenshot({ path: outPath });
    } else {
      console.error('[shot] selector missing at shot time, falling back to viewport');
      await page.screenshot(shotOpts);
    }
  } else {
    await page.screenshot(shotOpts);
  }

  console.error(`[shot] saved -> ${outPath}`);

  if (args['text-out']) {
    const textOutPath = path.resolve(args['text-out']);
    fs.mkdirSync(path.dirname(textOutPath), { recursive: true });
    let text;
    if (args.selector && typeof args.selector === 'string') {
      text = await page.$eval(args.selector, (el) => el.innerText).catch(async () => {
        return await page.evaluate(() => document.body.innerText);
      });
    } else {
      text = await page.evaluate(() => document.body.innerText);
    }
    // If output is a markdown file, wrap the dump in a fenced block + embed the
    // screenshot inline (relative path) so the file renders as a self-contained
    // proof on GitHub.
    const isMarkdown = textOutPath.toLowerCase().endsWith('.md');
    let body;
    if (isMarkdown) {
      const screenshotRel = path.relative(path.dirname(textOutPath), outPath).replace(/\\/g, '/');
      body = `# Page text dump\n\nSource: ${args.url}\n\n![Screenshot](${screenshotRel})\n\n\`\`\`\n${text}\n\`\`\`\n`;
    } else {
      body = text;
    }
    fs.writeFileSync(textOutPath, body, 'utf8');
    console.error(`[shot] text saved -> ${textOutPath}`);
  }

  await context.close();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {}
}

run().catch((e) => {
  console.error(`[shot] FAILED: ${e.stack || e.message}`);
  process.exit(1);
});
