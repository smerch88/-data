# MAIC Dropout Prediction (2025) — CPADP Framework

**Topic**: LLM-driven dropout prediction and intervention in Massive AI-empowered Courses
**Source**: https://arxiv.org/abs/2508.17310 (abstract) + https://arxiv.org/html/2508.17310 (full paper HTML)
**Captured**: 2026-05-09
**Verdict**: `confirmed`

![Screenshot](screenshot.png)

## Verification (from [text.md](text.md) + [text-html.md](text-html.md))

```
CPADP framework accuracy: 95.4% (PLM Fine-Tuning row)

Table 2: Dropout predictors result.
Method    Setting  Precision  Recall  F1_score  Accuracy
GPT-4     FS       0.921      0.450   0.604     0.779
PLM       FT       0.966      0.906   0.935     0.954

Re-login comparison:
14 logins during Days 63–65 versus 25 logins during Days 66–68
=> (25-14)/14 = 78.6% increase

n=17 caveat:
"we analyze the 17 students who log in during Days 66–68"
```

## Notes

- All four key numbers confirmed in the HTML full-paper: CPADP 95.4% accuracy / F1=0.935, GPT-4 few-shot 77.9% / F1=0.604.
- The +78.6% re-login figure is derived from the paper's Table 3 context (14 → 25 logins); the exact percentage is not stated verbatim but the raw numbers are.
- The n=17 caveat is explicit: the intervention study covered only 17 re-engaging students, split into 9 self-initiated and 8 recalled.
- Relevance: validates feasibility of LLM-driven personalized outreach to at-risk students; supports our email/SMS recall agent design.
