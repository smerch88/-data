# Claude API pricing

**Claim** (з PROJECT_VISION.md, оновлене): "Claude Sonnet $3/M input, $15/M output. Opus 4.5+ $5/$25 (Opus 4/4.1 $15/$75). Haiku 4.5 $1/$5 (Haiku 3.5 $0.80/$4)."
**Source**: https://docs.claude.com/en/docs/about-claude/pricing
**Captured**: 2026-05-09
**Verdict**: `confirmed` — після оновлення документа всі три моделі зіставлені з актуальними цифрами.

![Screenshot](screenshot.png)

## Verification (з [text.md](text.md))

```
Claude Opus 4.7   $5  / MTok ... $25 / MTok
Claude Opus 4.6   $5  / MTok ... $25 / MTok
Claude Opus 4.5   $5  / MTok ... $25 / MTok
Claude Opus 4.1   $15 / MTok ... $75 / MTok
Claude Opus 4     $15 / MTok ... $75 / MTok
Claude Sonnet 4.6 $3  / MTok ... $15 / MTok
Claude Sonnet 4.5 $3  / MTok ... $15 / MTok
Claude Sonnet 4   $3  / MTok ... $15 / MTok
Claude Haiku 4.5  $1  / MTok ... $5  / MTok
Claude Haiku 3.5  $0.80 / MTok ... $4 / MTok
```

## Notes

- **Sonnet**: підтверджено `$3 / $15` для всіх актуальних версій (4 / 4.5 / 4.6).
- **Opus**: твердження `$15/$75` стосується тільки **Opus 4 і 4.1**. Починаючи з **Opus 4.5+** Anthropic знизив ціну до **$5/$25** (5x дешевше output). Документ треба оновити.
- **Haiku**: `$0.80/$4` — це **Haiku 3.5**. Новий **Haiku 4.5** коштує **$1/$5**.
- Колонки на сторінці: Base Input / Cache Writes 5min (1.25x) / Cache Writes 1h (2x) / Cache Hit (0.1x) / Output. У PROJECT_VISION.md ми посилаємось тільки на Base Input + Output.
- Batch API: 50% знижка на обидві сторони, додатковий важіль для зменшення витрат.
