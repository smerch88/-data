# Online vs offline dropout — Christensen & Spackman 2017 (ERIC EJ1150708)

**Topic**: на скільки online-курси мають вищий dropout проти face-to-face; концепт "Course Walls" (де учні застрягають).
**Source**: Christensen, S. S., & Spackman, J. S. (2017). Dropout Rates, Student Momentum, and Course Walls: A New Tool for Distance Education Designers. *Journal of Educators Online*, v14 n2 Jul 2017. ERIC EJ1150708. Abstract: https://eric.ed.gov/?id=EJ1150708 ; PDF: https://files.eric.ed.gov/fulltext/EJ1150708.pdf
**Captured**: 2026-05-09
**Verdict**: `confirmed`.

![Screenshot](screenshot.png)
![Abstract](abstract.png)

## Verification (з [abstract.md](abstract.md))

```
Dropout Rates, Student Momentum, and Course Walls: A New Tool for Distance
Education Designers
Christensen, Steven S.; Spackman, Jonathan S.
Journal of Educators Online, v14 n2 Jul 2017

This paper explores a new tool for instructional designers. By calculating
and graphing the Student Momentum Indicator (M) for 196 university-level
online courses and by employing the constant comparative method within
the grounded theory framework, eight distinct graph shapes emerged as
meaningful categories of dropout behavior. Several of the graph shapes
identified Course Walls, that is, areas of the course's lesson sequence
wherein the student's momentum to finish the course is significantly
slowed or halted. We posit that instructional designers can apply the
evaluation of Course Walls to course revisions to reduce dropout rates.
```

Цитата з оригінального paper, виокремлена в командному дискусі:

> "Estimates of dropout rates are 10% to 20% higher than their face-to-face counterparts (Bart, 2012). Others show the dropout rate to be six or seven times higher in online courses when compared [to offline]."

## Notes

- **Online dropout vs offline**: на 10–20% вищий за face-to-face (Bart 2012); деякі студії — у **6–7 разів** вищий.
- **Student Momentum Indicator (M)** — метрика з paper, обчислена на 196 university-level online courses.
- **8 patterns dropout behavior** виявлено через grounded theory analysis.
- **Course Walls** — концепт: ділянка курсу, де момент студента зупиняється. Прив'язано до конкретних уроків/модулів, не глобально до курсу.
- **Висновок для нашого продукту**:
  - **Course Walls — конкретна product-фіча**, яку ми можемо реалізувати: знаходити модулі, де массово stalls активність, і повідомляти школу. Це emergent insight за межі окремого учня.
  - Для агента "Аналітик" — додати концепт "module-level dropout heatmap" (де когорта застрягає).
  - 6–7x різниця online vs offline + 30–50% baseline дропаут (з [eric-distance-ed](../eric-distance-ed/notes.md)) → online retention як проблема має значно більший ефект, ніж в офлайн-освіті.
