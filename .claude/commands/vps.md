---
description: Run a task on the VPS (delegates to vps-operator)
argument-hint: <what to do on the VPS>
---

The user wants something done on the VPS: **$ARGUMENTS**

Delegate to the `vps-operator` subagent. Pass the task verbatim. The agent handles SSH (via `infra/vps/vps-run.sh`), safety checks for destructive actions, and reports back with commands + output.

If `vps-operator` returns "ssh key not found" — tell the user to run `/vps-bootstrap` first, then re-run this command.
