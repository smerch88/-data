# proof-researcher

Утиліта для верифікації числових тверджень у `docs/PROJECT_VISION.md`. Робить скріншот публічної сторінки (наприклад, pricing-сторінки сервіса) і опційно зберігає текстовий зміст для пошуку.

Під капотом — **[Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-nodejs)** (stealth-форк Playwright з anti-detection patches). Звичайний Playwright блокується Akamai/Cloudflare bot-детекторами на pricing-сторінках великих SaaS (Tableau, Drata, Salesforce). Patchright обходить більшість detection-векторів через `launchPersistentContext` + Chrome channel + відсутність explicit fingerprint-параметрів.

## Установка

```bash
cd tools/proof-researcher
npm install
npx patchright install chromium
```

## Використання

```bash
node screenshot.js \
  --url "https://www.anthropic.com/pricing" \
  --out "../../docs/proofs/claude-pricing/screenshot.png" \
  --text-out "../../docs/proofs/claude-pricing/text.md" \
  --full
```

> Якщо `--text-out` закінчується на `.md`, скрипт автоматично обгортає dump у `# Page text dump` + code fence — щоб GitHub рендерив його як plain text, а не намагався парсити markdown.

Опції:

| Прапорець | Значення |
|---|---|
| `--url` | URL сторінки (обовʼязково) |
| `--out` | Шлях до PNG (обовʼязково). Створить батьківські папки. |
| `--text-out` | Опційний шлях для збереження `innerText`. |
| `--selector` | CSS-селектор: дочекатись + знімок саме цього елемента (а не всієї сторінки). |
| `--wait` | Додатковий ms-таймаут після `networkidle` (default 2000). |
| `--full` | Full-page screenshot (ігнорується якщо є `--selector`). |
| `--width` / `--height` | Розмір viewport (default 1440×900). |

## Як це працює

1. Запускає Patchright Chromium через `launchPersistentContext` з реальним Chrome channel — це stealth-режим, який обходить Akamai/Cloudflare на сайтах типу tableau.com.
2. Чекає `networkidle` (фолбек на `domcontentloaded` за тайм-аут).
3. Намагається закрити cookie-banners (Accept All / OK тощо).
4. Робить скріншот (full-page або по селектору).
5. Опційно зберігає `innerText` сторінки для подальшого `Grep`.

## Якщо все одно заблоковано

- **Akamai 403**: спробуй URL через Wayback Machine: `https://web.archive.org/web/2026/<URL>`. Архів повертає той же контент без bot-захисту.
- **Cloudflare challenge**: Patchright проходить більшість, але не всі. Деякі сайти (Drata) навмисне за `Contact sales` — задокументуй як `confirmed (як non-public)`.
- **JS-only прайс** (slider/tabs): значення може не потрапити в text dump. Дивись на screenshot.png або скористайся WebFetch як кросчеком.

## Конвенція папок

Кожен факт зберігається у `docs/proofs/<slug>/` як **три md/png файли**:

```
docs/proofs/
  claude-pricing/
    screenshot.png      # повний знімок pricing-сторінки
    text.md             # dump renderованого тексту, з embed ![Screenshot] нагорі
    notes.md            # цитата + verdict, з embed ![Screenshot] нагорі
  pinecone-pricing/
    ...
```

Усі три файли — самодостатні: відкривши будь-який `notes.md` чи `text.md` на GitHub, читач одразу бачить screenshot. `text.txt` більше не використовується.

`notes.md` пише агент `proof-researcher` (`.claude/agents/proof-researcher.md`).
