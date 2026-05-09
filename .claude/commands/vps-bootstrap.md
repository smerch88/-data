---
description: One-time SSH key setup for the VPS (generates key, installs it via password)
allowed-tools: Bash(bash infra/vps/bootstrap.sh:*), Bash(bash infra/vps/vps-run.sh:*)
---

Run the VPS bootstrap script:

```
bash infra/vps/bootstrap.sh
```

Expected outcomes:

- **"Key already authorized"** — already done, nothing to do.
- **"Key installed"** — automatic install via sshpass succeeded. Verify with `bash infra/vps/vps-run.sh 'whoami; hostname'`.
- **"Cannot install the key automatically"** — sshpass is missing. Show the printed one-liner to the user verbatim and tell them to paste it into their terminal (it will prompt for the VPS password once). After they confirm, re-run `bash infra/vps/bootstrap.sh` to verify.

After the key is in place, `vps-operator` can connect from any future session without password prompts.
