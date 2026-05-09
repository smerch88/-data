# edX — обсяги і перший масштабний MOOC

**Topic**: масштаб edX, перші MITx-курси (контекст для AUC-цифри з Whitehill 2017).
**Source**: https://en.wikipedia.org/wiki/EdX
**Captured**: 2026-05-09
**Verdict**: `confirmed`.

![Screenshot](screenshot.png)

## Verification (з [text.md](text.md))

```
Users  83 million (2023)

edX was founded in May 2012 by MIT and Harvard... Gerry Sussman, Anant Agarwal,
Chris Terman, and Piotr Mitros taught the first edX course on circuits and
electronics from MIT, drawing 155,000 students from 162 countries.

As of July 2020, there were 3,000 courses available for its 33 million
registered students.

On July 25, 2024, 2U filed for Chapter 11 bankruptcy protection.
```

## Notes

- **Аудиторія**: 83 млн юзерів (2023), 33 млн зареєстрованих з 3000 курсами (2020).
- **Перший MITx курс**: 155k студентів, 162 країни — це той клас курсів, на якому Whitehill et al. 2017 виміряли AUC дропауту 87.33–90.20%.
- **2U bankruptcy**: материнська компанія edX подала на Chapter 11 у липні 2024 — додатковий доказ, що навіть на масштабі 80M+ юзерів MOOC-економіка не сходиться.
- **Висновок**: edX-датасет (40 HarvardX MOOCs, 8 тижнів × 155k+ enrollment кожен) — найбільш надійне джерело для baseline-перформансу ML на дропауті, тому що академічний research-консорціум (HarvardX/MITx) публікує дані.
