# Intelligent Tutoring Systems — meta-analysis ефективності

**Topic**: empirical effectiveness of AI tutoring vs traditional classroom; meta-analyses 1995, 2011, 2015.
**Source**: https://en.wikipedia.org/wiki/Intelligent_tutoring_system. Cited primary sources include VanLehn (2011), Kulik & Fletcher (2015), Corbett (2001).
**Captured**: 2026-05-09
**Verdict**: `confirmed`.

![Screenshot](screenshot.png)

## Verification (з [text.md](text.md))

```
Reviews of early ITS systems (1995) showed an effect size of d = 1.0 in
comparison to no tutoring, where as human tutors were given an effect size
of d = 2.0.

Kurt VanLehn's much more recent overview (2011) of modern ITS found that
there was no statistical difference in effect size between expert one-on-one
human tutors and step-based ITS.

A 2015 meta-analysis suggests that ITSs can exceed the effectiveness of
both CAI and human tutors, especially when measured by local (specific)
tests as opposed to standardized tests.

"Students who received intelligent tutoring outperformed students from
conventional classes in 46 (or 92%) of the 50 controlled evaluations,
and the improvement in performance was great enough to be considered of
substantive importance in 39 (or 78%) of the 50 studies. The median ES
in the 50 studies was 0.66, which is considered a moderate-to-large effect
for studies in the social sciences. It is roughly equivalent to an
improvement in test performance from the 50th to the 75th percentile."

"ITS gains are about twice as high [as CAI tutoring at ES 0.31]. The ITS
effect is also greater than typical effects from human tutoring [ES 0.4]."

Average ES on studies with local tests: 0.73
Average ES on studies with standardized tests: 0.13

KERMIT (early version of EER-Tutor): "significant improvement of student's
knowledge after one hour of learning (with the effect size of 0.6)".
```

## Notes

- **3 ключові meta-analyses ефективності AI tutoring**:
  - **1995**: ITS effect size = 1.0 (vs no tutoring); human tutors = 2.0 (підтверджує Bloom 1984).
  - **VanLehn 2011**: модерні step-based ITS — **statistically не відрізняються від expert human tutors**. Це переломний результат — AI здобув паритет з людьми.
  - **Kulik & Fletcher 2015 meta-analysis** на 50 досліджень: median ES = **0.66**. ITS перемогли в 92% порівнянь (46 з 50).
- **Контекст для нашої цінності**:
  - 0.66 sigma = переведення з 50-го перцентиля на 75-й. Це translatable у retention: якщо клас дропає 30%, з ITS дропатиме ~17–20%.
  - **AI tutoring у ~2 рази ефективніше за CAI** (Computer-Assisted Instruction; ES 0.31).
  - **AI tutoring трохи ефективніше за human tutoring** на локальних тестах (ES 0.66 vs 0.4).
- **Local vs standardized tests** — критична деталь:
  - Local (specific) tests: ES = **0.73**.
  - Standardized tests: ES = **0.13** (значно нижче).
  - Локальні тести вирівнюються з конкретною педагогікою програми; стандартизовані — ні. Тому AI tutoring особливо ефективне для **focused learning goals** (наш use case — конкретний bootcamp/course), не для general academic outcomes.
- **Висновки для нашого продукту**:
  - Multi-agent система = applied ITS на масштабі. Базуючись на meta-analysis 0.66 ES, реалістичний таргет ефекту: **15–25% reduction in dropout** на ранньому пілоті (Kulik & Fletcher 2015 показує що навіть дешеві CAI дають 0.31 ES = 12% reduction).
  - **Limitations** (з paper, чесно): ITS дорогі в розробці (300 годин розробки на 1 годину навчання за surveys). Для нас — це аргумент за **scalability через LLM** замість традиційних rule-based ITS.
  - **AI + human hybrid** виграє: "the largest exam-score gains in the condition that combined AI tutoring with structured peer collaboration". Тому нам важливо лишити **human-in-the-loop** в action layer (менеджер натискає Send).
