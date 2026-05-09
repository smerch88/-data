# MOOC dropout prediction AUC — Whitehill et al. 2017

**Topic**: точність ML-моделей дропауту на MOOC.
**Source**: https://arxiv.org/abs/1702.06404 — Whitehill, Mohan, Seaton, Rosen, Tingley (HarvardX), "Delving Deeper into MOOC Student Dropout Prediction" (Feb 2017).
**Captured**: 2026-05-09
**Verdict**: `confirmed`.

![Screenshot](screenshot.png)

## Verification (з [text.md](text.md))

```
Results suggest that (1) training and testing on the same course ("post-hoc")
can overestimate accuracy by several percentage points;

(2) dropout classifiers trained on proxy labels based on students' persistence
are surprisingly competitive with post-hoc training (87.33% versus 90.20% AUC
averaged over 8 weeks of 40 HarvardX MOOCs);

(3) classifier performance does not vary significantly with the academic
discipline.

(4) networks with as many as 5 hidden layers can statistically significantly
increase test accuracy over that of logistic regression.
```

## Notes

- **AUC ML-моделі дропауту**:
  - 90.20% AUC — стандартний "post-hoc" режим (train+test на одному курсі).
  - 87.33% AUC — proxy-label режим (натренована на одних курсах, тестована на нових — реалістичний production-сценарій).
  - Розрив "post-hoc" vs production режим — приблизно 3 п.п. AUC.
- **Виміряно на**: 40 HarvardX MOOCs, 8 тижнів кожен.
- **Архітектура**: clickstream features + logistic regression baseline; 5-layer neural network — статистично значуще краще за logistic regression.
- **Висновок для нашого продукту**: можна цілитись на ~85–90% AUC на нових курсах за умови достатнього historical dataset; перші клієнти отримають нижчий performance до накопичення даних (cold start).
