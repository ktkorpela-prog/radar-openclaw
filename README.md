# @essentianlabs/openclaw-radar

OpenClaw plugin that wraps [@essentianlabs/radar-lite](https://www.npmjs.com/package/@essentianlabs/radar-lite) as tools for OpenClaw agents.

Registers three tools — `radar_assess`, `radar_strategy`, `radar_reload` — so any OpenClaw agent can assess risk before acting.

---

## Advisory notice

**RADAR produces risk intelligence, not safety assurance.** It structures reasoning — it does not validate decisions.

- RADAR assesses **action descriptions only**, not actual execution. The assessment reflects what was described, not what occurs.
- A **PROCEED verdict is not authorization or approval**. It means "not held by this assessment." Liability for the action remains with the developer, operator, and end user.
- RADAR can produce PROCEED verdicts that later prove harmful or incorrect. The assessment reflects the information available at the time of the call.
- **Liability is not transferred, reduced, or shared** by using RADAR. It remains with the developer, operator, and end user in all cases.
- If an external LLM provider is configured (Anthropic, OpenAI, or Google), **action text leaves the local machine** for Vela Lite assessment. Without a provider configured, assessments use the local rules engine only.

RADAR is in **beta**. Not recommended for enterprise or production use without independent legal and compliance review.

---

## When RADAR adds value

RADAR is not a replacement for VS Code's permission prompts or Claude Code's built-in allow/deny system. Those control whether an action is permitted on your machine. RADAR answers a different question: should this action happen at all, given the risk?

**RADAR adds value when:**

**Your agent runs unsupervised.**
No one is watching. No permission prompt will fire. The agent takes actions — sends emails, modifies files, calls APIs, processes payments — and the first you know about it is the outcome. RADAR is the governance layer between intent and action when there is no human in the loop.

**The action affects other people.**
Sending to 50,000 users. Deleting customer records. Publishing content. Processing a refund. VS Code permissions don't exist for these actions. RADAR assesses them before they execute.

**You need an audit trail.**
"We assessed this before acting" is a defensible position. RADAR creates a permanent record of every assessment — what was assessed, what Vela concluded, what the developer decided. VS Code's allow/deny creates no audit trail.

**You're deploying agents in an organisation.**
Multiple agents, multiple operators, no one watching every action. RADAR gives you a consistent governance layer across all of them — same assessment standards, same record, same escalation paths.

**RADAR adds less value when:**

- You are a developer running Claude Code on your own machine, watching every action
- VS Code's built-in permission prompts are already covering the actions you care about
- All your agent's actions are reversible and low-stakes

**The right mental model:**
Think of RADAR as governance infrastructure for agents that operate without a human watching — not as a replacement for tools that already exist when a human is present.

The OpenClaw integration is designed for agents that run autonomously — the plugin assesses each action before the agent executes it, with no human in the loop unless RADAR holds or denies the action.

---

## Install

```bash
npm install @essentianlabs/openclaw-radar
```

### CLI setup

After installing, run the setup command to add RADAR instructions to `~/.claude/CLAUDE.md`:

```bash
npx openclaw-radar install
```

This adds an instruction block (wrapped in `<!-- OPENCLAW-RADAR -->` markers) that tells Claude-based agents to call `radar_assess` before every task.

To remove:

```bash
npx openclaw-radar uninstall
```

Other commands:

```bash
npx openclaw-radar --version      # Print version
npx openclaw-radar --dashboard    # Open RADAR configuration dashboard
```

**Note:** MCP servers and CLAUDE.md instructions load at session start. Existing Claude Code sessions need to be restarted to pick up changes.

## Configuration

The plugin reads LLM provider keys from environment variables:

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key (default provider) |
| `OPENAI_API_KEY` | OpenAI API key (fallback) |
| `GOOGLE_API_KEY` | Google API key (fallback) |
| `T2_PROVIDER` | Separate provider for T2 assessments |
| `T2_API_KEY` | Separate API key for T2 assessments |

Provider priority: Anthropic > OpenAI > Google.

> **An LLM API key is required for Vela Lite reasoning.** Without one, RADAR still scores and holds risky actions using the local rules engine, but HOLD verdicts will not include strategy options (`options`), recommendations (`recommended`), or Vela's written reasoning — these fields return `null`. Set at least one of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_API_KEY`.
>
> Configure your key via the dashboard: `npx @essentianlabs/radar-lite dashboard`

Dual-provider segregation: set `T2_PROVIDER` and `T2_API_KEY` to use a different provider for Tier 2 assessments than for Tier 1.

## Plugin manifest

Add to your OpenClaw configuration:

```json
{
  "plugins": {
    "entries": {
      "openclaw-radar": {
        "enabled": true
      }
    }
  }
}
```

## Tools registered

### `radar_assess`

Assess an intended action for risk before executing it.

**Parameters:**
- `action` (string, required) — What the agent intends to do
- `activityType` (string, required) — Category: `email_single`, `email_bulk`, `publish`, `data_read`, `data_write`, `data_delete_single`, `data_delete_bulk`, `web_search`, `external_api_call`, `system_execute`, `system_files`, `financial`
- `agentId` (string, optional) — Agent identifier

**Returns:** Assessment result with `status` (`PROCEED` | `HOLD` | `DENY`), `riskScore`, `vela` reasoning, and `options` for HOLD verdicts.

### `radar_strategy`

Record a risk strategy decision after a HOLD verdict.

**Parameters:**
- `callId` (string, required) — The `callId` from the assessment result
- `strategy` (string, required) — `avoid`, `mitigate`, `transfer`, `accept`, or `override_deny`
- `reason` (string, optional) — Why this strategy was chosen
- `decidedBy` (string, optional) — Who made the decision

### `radar_reload`

Force re-read of RADAR configuration from disk. No parameters.

## Verdict model

| Tier | Verdict | Meaning |
|------|---------|---------|
| T1 | PROCEED | Action assessed, not held |
| T2 | HOLD | Requires review — agent must present options and wait |
| Policy/high risk | DENY | Blocked by policy or high risk — do not proceed without explicit override |

- `result.proceed` (boolean) for backward compatibility
- `result.status` (`PROCEED` | `HOLD` | `DENY`) is the primary verdict
- T2 never returns PROCEED — the verdict is always HOLD

## Skill

The plugin includes `skills/radar/SKILL.md` which instructs agents when and how to call these tools. It is loaded automatically by OpenClaw when the plugin is enabled.

## Dependencies

- [@essentianlabs/radar-lite](https://www.npmjs.com/package/@essentianlabs/radar-lite) ^0.3.1 — local risk assessment library using sql.js (WASM-based SQLite)

No server calls for T1/T2 assessment logic. Database stored at `~/.radar/register.db`.

## License

MIT licensed and free to use. See [LICENSE](LICENSE).

The RADAR client packages — `radar-lite`, `radar-mcp`, `openclaw-radar` — are MIT licensed. The hosted Vela Essentian™ service and supporting infrastructure are proprietary and operated by EssentianLabs.
