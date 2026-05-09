# Distance education dropout drivers — Yukselturk & Inan 2008 (ERIC ED494345)

**Topic**: фактори, що впливають на дропаут в online learning, і indicative dropout rate distance education у літературі.
**Source**: Yukselturk, E., & Inan, F. A. (2008). Examining the Factors Affecting Student Dropout in an Online Learning Environment. ERIC ED494345. Abstract: https://eric.ed.gov/?id=ED494345 ; PDF: https://files.eric.ed.gov/fulltext/ED494345.pdf
**Captured**: 2026-05-09
**Verdict**: `confirmed`.

![Screenshot](screenshot.png)
![Abstract](abstract.png)

## Verification (з [abstract.md](abstract.md))

```
Examining the Factors Affecting Student Dropout in an Online Learning Environment
Yukselturk, Erman; Inan, Fethi Ahmet

This study examined the factors affecting student dropouts in an online
certificate program. In this research, a combination of quantitative and
qualitative methods was used. Online Course Dropout Survey was developed
and used to determine which factors affect student attrition from the
program. The dropout survey was sent by e-mail to 98 students who had
dropped the program. Twenty-six students returned the survey. The findings
show that the most important factor affecting student retention is finding
sufficient time to study. Having personal problems and affordability of
the program took second and third place. (Contains 4 tables.)
```

Цитата з оригінального paper (PDF) — командний дискус у чаті виділив як ключову:

> "It is reported that the distance education dropout rate is approximately 30–50% (Parker, 1995; Hill & Raven, 2000; Frankola, 2001)."
> "In Europe, dropout rates in distance education programs typically range from 20 percent to 30 percent ... and Asian countries have recorded rates as high as 50 percent (Shin and Kim, 1999)."

## Notes

- **Distance education dropout rate: 30–50%** (літературний consensus, цитований Yukselturk & Inan з кількох первинних джерел: Parker 1995, Hill & Raven 2000, Frankola 2001).
- **Регіональна варіація**: Європа 20–30%, Азія до 50%, США в межах 30–50%.
- **Top-3 фактори дропауту з survey (n=26 dropped students)**:
  1. **Time to study** (найважливіший).
  2. **Personal problems**.
  3. **Affordability** (ціна програми).
- **Висновок для нашого продукту**:
  - 30–50% — це floor для нашого pitch'у проблеми. На українських онлайн-школах (GoIT, Hillel, Projector) chat-цифра 30–50% узгоджується з академічним baseline.
  - Драйвер #1 (time to study) → feature engineering: відстежувати **інтервали між сесіями + регулярність активності**, не тільки сумарну активність. Учень з time-pressure буде давати "burst-then-silence" патерн.
  - Драйвер #2 (personal problems) → AI-агент "Спостерігач" має детектувати в чатах згадки життєвих обставин, які ML на табличних фічах не побачить. Це підтверджує цінність multi-agent vs pure ML.
  - Драйвер #3 (affordability) → action layer повинен мати "freeze course / payment plan / scholarship" як valid інтервенцію.
