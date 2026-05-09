# Uplift modeling — фундаментальна сегментація

**Topic**: чому uplift-модель ≠ propensity-модель; які 4 сегменти юзерів вона розрізняє.
**Source**: https://en.wikipedia.org/wiki/Uplift_modelling
**Captured**: 2026-05-09
**Verdict**: `confirmed`.

![Screenshot](screenshot.png)

## Verification (з [text.md](text.md))

```
Uplift modelling, also known as incremental modelling, true lift modelling,
or net modelling, is a predictive modelling technique that directly models
the incremental impact of a treatment (such as a direct marketing action)
on an individual's behaviour.

The Persuadables: customers who only respond to the marketing action because
they were targeted

The Sure Things: customers who would have responded whether they were targeted
or not

The Lost Causes: customers who will not respond irrespective of whether or
not they are targeted

The Do Not Disturbs or Sleeping Dogs: customers who are less likely to respond
because they were targeted

The only segment that provides true incremental responses is the Persuadables.

Traditional response modelling often targets the Sure Things, being unable
to distinguish them from the Persuadables.

One of the most effective uses of uplift modelling is in removing negative
effects from retention campaigns. In telecommunications and financial services
industries, retention campaigns can trigger customers to cancel a contract
or policy. Uplift modelling allows these customers — the Do Not Disturbs —
to be removed from the campaign.
```

## Notes

- **Чотири сегменти**: Persuadables (тільки вони дають incremental ROI), Sure Things, Lost Causes, Do Not Disturbs / Sleeping Dogs.
- **Ключовий висновок**: traditional churn-prediction цілить у Sure Things; uplift modeling цілить у Persuadables.
- **Sleeping Dogs / Do Not Disturbs ефект**: у telco і фінансах retention-кампанії статистично *підвищують* churn серед "сплячих" клієнтів — такі юзери мають бути виключені з кампанії, не залучені.
- **Основні папери в історії** (cited): Lo (2002) "The True Lift Model"; Radcliffe (2007) "Using Control Groups to Target on Predicted Lift"; Rzepakowski + Jaroszewicz (2010-2014) — uplift decision trees + multi-treatment + survival analysis.
- **Висновок для нашого продукту**: етап 2 ML-моделі (XGBoost churn prediction) ≠ робоче рішення для retention. Для measurable uplift треба окрема модель з RCT-розбивкою на treatment/control.
