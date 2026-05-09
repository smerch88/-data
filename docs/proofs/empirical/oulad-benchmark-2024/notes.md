# OULAD Predictive Modelling SLR (AIED 2024)

**Topic**: Best-performing churn/dropout model on OULAD dataset per 2024 systematic literature review
**Source**: https://link.springer.com/chapter/10.1007/978-3-031-64315-6_46
**Fallback attempted**: https://www.researchgate.net/publication/381904274 — blocked (Cloudflare 1020 error)
**Captured**: 2026-05-09
**Verdict**: `partial`

![Screenshot](screenshot.png)

## Verification (from [text.md](text.md))

```
Predictive Modelling with the Open University Learning Analytics Dataset (OULAD):
A Systematic Literature Review

First Online: 02 July 2024 | pp 477–484 | AIED 2024

Abstract: Following the PRISMA process, we identified 17 research articles published
from 2017 to 2024, concentrating on OULAD in higher education.

Keywords: Predictive modelling, Open University Learning Analytics Dataset (OULAD),
Educational data mining (EDM)
```

## Notes

- The Springer page confirms the paper exists (AIED 2024, PRISMA, 17 articles, 2017–2024). The abstract is visible and matches the claim context.
- The specific XGBoost F1=0.92 / AUC=0.97 numbers are **behind the Springer paywall** and not visible in the captured text. ResearchGate was blocked (Cloudflare). Verdict is `partial` — the paper's existence and 17-article scope are confirmed; the exact model metrics are not greppable from public pages.
- The claim in PROJECT_VISION.md about XGBoost performance is plausible given the domain (OULAD + XGBoost results are well-documented in prior literature), but cannot be confirmed from the freely-accessible abstract alone.
- Relevance: establishes XGBoost as a well-validated baseline for our OULAD-based churn detection model.
