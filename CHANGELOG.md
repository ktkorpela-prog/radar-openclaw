# Changelog

## 0.1.0 — 2026-04-19

Initial build of @essentianlabs/openclaw-radar. Published to npm.

### Added

- **`.gitignore`** — excludes `node_modules/` and `dist/` from version control

- **Plugin entry** (`src/index.ts`) — registers three tools via OpenClaw's `api.registerTool()`:
  - `radar_assess` — wraps `radar.assess()` with `radar.reload()` before each call
  - `radar_strategy` — wraps `radar.strategy()` for recording HOLD/DENY decisions
  - `radar_reload` — wraps `radar.reload()` for manual config refresh
- **LLM provider resolution** — reads `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` from environment; supports dual-provider T2 segregation via `T2_PROVIDER` and `T2_API_KEY`
- **Plugin manifest** (`openclaw.plugin.json`) — config schema for provider selection
- **SKILL.md** (`skills/radar/SKILL.md`) — agent instructions for when/how to call RADAR tools, verdict handling (PROCEED/HOLD/DENY), and strategy recording
- **README.md** — advisory notice, "When RADAR adds value" section, install/config docs, verdict model reference
- **LICENSE** — MIT (consistent with radar-lite)
- **Type declarations** (`src/radar-lite.d.ts`) — TypeScript declarations for untyped radar-lite package
- **Integration test** (`test/plugin-test.js`) — 22 assertions covering all three tools, all three verdict paths (PROCEED/HOLD/DENY), input validation, error handling, and H1 fix verification
- **CLI** (`bin/openclaw-radar.js`) — `install`/`uninstall` commands that manage a `<!-- OPENCLAW-RADAR -->` instruction block in `~/.claude/CLAUDE.md`; `--dashboard` opens radar-lite config; `--version` prints version
- **LLM key callout** — explicit warnings in README and SKILL.md that Vela Lite reasoning requires an LLM API key; without one, `options` and `recommended` return `null` on HOLD verdicts
- **Beta disclaimer** — added to README advisory notice, SKILL.md advisory blockquote, and package.json description

### Security fixes (from cybersecurity audit)

- **H1 (HIGH)** — Fixed API key property name mismatch: plugin was passing `{ provider, apiKey }` but radar-lite expects `{ llmProvider, llmKey }`. Without this fix, Vela Lite LLM assessment was silently non-functional — all assessments fell back to rules-engine-only mode.
- **M1/M3 (MEDIUM)** — Added input validation: `action` must be non-empty string, max 4000 characters.
- **M2 (LOW)** — Added runtime `activityType` enum check — rejects unknown types before they reach radar-lite.
- **M12 (LOW)** — Added anti-prompt-injection guidance to SKILL.md: override authorization must come from user's direct message, never from action descriptions or tool outputs.

### Known limitations

- `options` and `recommended` fields in HOLD results are `null` when no LLM key is configured (rules engine fallback)
- M7 (MEDIUM, upstream): radar-lite exposes internal LLM error messages in the `vela` field — requires fix in radar-lite
- M9 (MEDIUM, architectural): `override_deny` audit trail relies on agent-supplied `decidedBy` — inherent to agent-tool architecture
