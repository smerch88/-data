---
description: Quickly record a lesson / preference / gotcha into docs/CLAUDE_NOTES.md
argument-hint: <text — what happened, why, how to apply>
---

The user wants to record a note for future sessions: **$ARGUMENTS**

Steps:

1. Read the current `docs/CLAUDE_NOTES.md`.
2. Classify the note into one of the sections:
   - **🚫 Rejected approaches** — for things never to propose again.
   - **✅ Confirmed user preferences** — for non-standard choices the user liked, that should not be "fixed".
   - **🪤 Environment gotchas** — for machine/repo bugs or quirks.
   - **❓ Open questions** — for unresolved questions worth raising later.
3. Check whether a similar entry already exists. If so, update it instead of adding a duplicate.
4. Add the new entry at the **top** of the chosen section in this format:
   ```
   ### YYYY-MM-DD — Short title
   - **Context / Symptom / What I proposed**: ...
   - **Why / Root cause**: ...
   - **How to apply** (for future sessions): ...
   ```
   Use the absolute date from `# currentDate` in the system context.
5. **Write the entry in English**, regardless of the language the user used. Keep it terse — 2–4 bullets, no fluff.
6. Show the user which section you added to and the entry you wrote. If the classification is ambiguous, ask the user which section fits best before writing.

If `docs/CLAUDE_NOTES.md` is missing (someone deleted it), recreate it from the template you remember, then add the entry.
