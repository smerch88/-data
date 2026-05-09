# Clerk pricing

**Claim** (оновлено в PROJECT_VISION.md): "Clerk — free tier 50,000 MRUs (Hobby); Pro $25/міс ($20 annual); $0.02/MRU у діапазоні 50k–100k (далі дешевше до $0.012); Business $300/міс."
**Source**: https://clerk.com/pricing
**Captured**: 2026-05-09
**Verdict**: `confirmed`.

![Screenshot](screenshot.png)

## Verification (з [text.md](text.md))

```
Hobby (Free):  $0
Pro:           $25/mo, $20/mo billed annually
Business:      $300/mo, $250/mo billed annually

Included MRUs: 50,000 MRUs included per app
50,001 - 100,000:    $0.02/mo each
100,001 - 1,000,000: $0.018/mo each
1,000,001 - 10M:     $0.015/mo each
10,000,001+:         $0.012/mo each
```

## Notes

- **Free tier**: тепер **50,000 MRUs (Monthly Retained Users)** — у 5 разів більше ніж "10,000 MAU" у документі. Clerk перейшов з MAU на MRU (юзер вважається retained, якщо повернувся через 24+ години після реєстрації).
- **Paid від $25/міс** — підтверджено (Pro tier).
- **$0.02 за юзера** — підтверджено, але тільки в діапазоні 50k–100k. Далі ціна знижується до $0.012 на масштабі.
- Документ треба оновити: 50k MRUs замість 10k MAU.
