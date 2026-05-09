# Auth0 pricing

**Claim** (оновлено в PROJECT_VISION.md): "Auth0 — free tier 25,000 MAU, далі платні плани через слайдер MAU."
**Source**: https://auth0.com/pricing
**Captured**: 2026-05-09 (Patchright stealth)
**Verdict**: `confirmed` (free tier).

![Screenshot](screenshot.png)

## Verification (з [text.md](text.md))

```
Free
Up to 25,000 monthly active users
Start building for free
```

Платні плани (B2B Essentials / B2C Essentials / Professional / Enterprise) на сторінці є, але конкретні $/міс рендеряться через інтерактивний слайдер MAU — у text-dump потрапили тільки заголовки `$ / month` без чисел. Дивись [screenshot.png](screenshot.png) для актуальних цифр.

## Notes

- **Free tier**: збільшений з 7,000 до **25,000 MAU**. Документ треба оновити.
- **Paid**: цифру "$240/міс" з оригінального тексту неможливо перевірити з самого text-dump (Auth0 ховає прайс за слайдером MAU). Скріншот показує реальні значення; потрібен ручний перегляд у браузері або повторний запуск з `--selector` на pricing card.
- Free план *повинен бути більш ніж достатнім* для перших 5–10 платних клієнтів (1k учнів × 10 = 10k MAU, що ще в межах безкоштовного).
