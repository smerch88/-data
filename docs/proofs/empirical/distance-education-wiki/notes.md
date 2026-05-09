# Distance education — драйвери дропауту

**Topic**: документовані причини, чому distance-learning студенти випадають частіше за традиційних.
**Source**: https://en.wikipedia.org/wiki/Distance_education
**Captured**: 2026-05-09
**Verdict**: `confirmed`.

![Screenshot](screenshot.png)

## Verification (з [text.md](text.md))

```
Barriers to effective distance education include obstacles such as domestic
distractions and unreliable technology, as well as students' program costs,
adequate contact with teachers and support services, and a need for more
experience. Additionally, students' lack of digital literacy and self-regulation
skills have contributed to increased dropout rates, emphasizing the need for
institutional training support.

The results of a study of Washington state community college students showed
that distance-learning students tended to drop out more often than their
traditional counterparts due to difficulties in language, time management,
and study skills.
```

## Notes

- **Документовані драйвери дропауту distance-learning студентів**:
  - Domestic distractions (сімейні/побутові відволікання).
  - Unreliable technology.
  - Cost barriers.
  - Lack of contact with teachers/support.
  - **Self-regulation skills** (саморегуляція) — найчастіша причина у академічних дослідженнях.
  - Time management.
  - Language difficulties (для community college sample).
- **Конкретне дослідження**: Washington state community college — distance students drop out **частіше** за традиційних. Конкретний відсоток у статті не наведений (треба читати оригінал Kirtman 2009 із джерел).
- **Висновок для нашого продукту**: фічі, що корелюють з self-regulation (час між сесіями, регулярність, час доби), мають бути в feature set ML-моделі — вони тематично відповідають документованим драйверам.
