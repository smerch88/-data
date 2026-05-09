# n8n — Multi-Agent System Limitations and Design Constraints

**Topic**: Multi-agent system failure modes, coordination limits, and n8n design boundaries
**Source**: https://blog.n8n.io/multi-agent-systems/
**Captured**: 2026-05-09
**Verdict**: `partial`

![Screenshot](screenshot.png)

## Verification (from [text.md](text.md))

```
Coordination overhead scales with agent count:
The communication complexity grows exponentially with the number of agents.
Three agents coordinate three relationships. Ten agents need forty-five.

Quality drift compounds through agent chains:
An error made by one agent affects downstream processes. A data extraction agent
misreads a field, the validation agent approves it based on an incorrect schema...

Security depends on your threat model:
Client-facing systems are vulnerable to prompt injection attacks...
hidden instructions in webpage content can steal credentials and exfiltrate sensitive data.

Token costs multiply across the system:
Multi-agent systems use significantly more tokens than single-agent approaches.
Research by Antropic shows that multi-agent systems outperformed single agents by 90.2%.
They also consumed 15× more tokens.
```

## Notes

- The article confirms coordination complexity, quality drift, token cost explosion, and security failure modes — all directly relevant to the claim.
- The **"5–7 tools per agent sweet spot"** is **not mentioned** in this article. That figure comes from Anthropic's internal research (cited in their multi-agent documentation), not from n8n's blog. The n8n article does advocate splitting tools across specialized sub-agents rather than giving one agent many tools.
- "Statelessness" as a concern and "duplicate charges / corrupted records" as specific failure examples are also not verbatim in this article. The article mentions quality drift and cascading errors but not those specific examples.
- Verdict is `partial`: the general multi-agent failure mode narrative is confirmed; the specific 5-7 tools figure and verbatim examples are not on this page.
- Relevance: the n8n blog reinforces the design decision to use specialized sub-agents with limited tool scope rather than monolithic orchestration in our retention platform.
