# MongoDB Atlas pricing

**Claim** (оновлено в PROJECT_VISION.md): "MongoDB Atlas — Free (M0) безкоштовно навічно; Flex $0.011/год до $30/міс; Dedicated від $56.94/міс."
**Source**: https://www.mongodb.com/pricing
**Captured**: 2026-05-09
**Verdict**: `confirmed`.

![Screenshot](screenshot.png)

## Verification (з [text.md](text.md))

```
Free       $0           Free forever (M0 cluster)
Flex       $0.011/hour  Up to $30/month
Dedicated  $0.08/hour   Starts at $56.94/month
```

## Notes

- **Free (M0)**: підтверджено, навічно.
- **Flex**: $0.011/година, *максимум* $30/міс — заміна старого M2/M5 shared.
- **Dedicated**: від $56.94/міс.
- Цифру `$9/міс` з документа треба замінити на `від $30/міс` (Flex cap) або `від $56.94/міс` (Dedicated).
- Старі M2 ($9/мiс) і M5 ($25/міс) shared tier-и більше не пропонуються — мігрували у Flex.
