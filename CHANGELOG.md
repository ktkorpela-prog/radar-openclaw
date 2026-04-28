# Changelog

## 0.2.0 — 2026-04-20

Hardening release. Adapts patterns from radar-mcp v3+: shared instruction module, safe filesystem wrapper, plugin-load startup checks, and an expanded test suite.

### Added

- **`src/instruction.ts`** — Single source of truth for the CLAUDE.md instruction block. Exports `OPENCLAW_MARKER`, `OPENCLAW_INSTRUCTION`, and `extractCurrentBlock()`. Both the CLI and the plugin import from here so the instruction text never drifts. Uses MUST / MUST NOT language explicitly forbidding the agent from picking strategies on the user's behalf.
- **`src/safe-fs.ts`** — `safeReadFile()` and `safeWriteFile()` wrap raw `fs` calls with two protections: (1) refuse to follow or write through symlinks (`lstatSync().isSymbolicLink()`), (2) cap reads at 1 MiB. Used everywhere the package touches `~/.claude/CLAUDE.md`. Prevents arbitrary file overwrite via a poisoned symlink and memory bombs from a pathological CLAUDE.md.
- **Startup checks in `register()`** — three informational checks that run when the OpenClaw plugin loads:
  - `checkLlmKey()` — warns to stderr if no LLM API key is configured (Vela Lite degraded to rules engine)
  - `checkClaudeMdSync()` — reads CLAUDE.md (via safe-fs), compares the block between markers against the canonical instruction. If they differ, logs a stderr message telling the user to run `npx openclaw-radar install`. Catches users who upgraded the package but forgot to refresh the instruction.
  - `checkRadarLiteVersion()` — fetches the latest radar-lite version from npm registry, caches result for 24h at `~/.radar/.openclaw-update-check`, fire-and-forget with 3-second `AbortController` timeout. Logs an update reminder to stderr if a newer version is available. Silent on offline/registry errors.
- **`peerDependencies`** — `@essentianlabs/radar-lite: ^0.3.0` (in addition to `dependencies`). Lets npm warn on version mismatch.
- **CLI version compatibility check** — `npx openclaw-radar install` now reads the installed radar-lite version and exits with a clear error + update command if it falls outside the peer dep range.
- **`test/unit.test.js`** — 16 new tests using Node's built-in `node:test` runner. Covers safe-fs (symlink rejection on read and write, oversized file rejection, edge case at 1 MiB cap) and instruction module (MUST language, marker handling, extractCurrentBlock).

### Changed

- **`bin/openclaw-radar.js`** — Refactored to import `OPENCLAW_MARKER`, `OPENCLAW_INSTRUCTION` from `dist/instruction.js` and use `safeReadFile` / `safeWriteFile` for all CLAUDE.md operations.

### Test totals

22 integration tests (plugin-test.js) + 16 unit tests (unit.test.js) = **38 tests, all passing**.

## 0.1.1 — 2026-04-20

### Fixed

- **Error boundaries** — All three tool `execute()` functions now catch errors and return `{ error: "..." }` instead of throwing unhandled exceptions. Prevents agent crashes from unexpected radar-lite errors.
- **`files` field** — Added to `package.json` so npm only publishes `dist/`, `bin/`, `skills/`, and config files. Excludes `src/`, `test/`, and `tsconfig.json`. Package size reduced from 13.9 kB to 10.4 kB.
- **`repository` field** — Points to radar-lite repo on npm page.
- **`homepage` field** — Links to docs at radar.essentianlabs.com.
- **`engines` field** — Added `"node": ">=18.0.0"` — clear error instead of cryptic WASM failure on older Node.
- **SKILL.md DENY description** — Removed score threshold ("20+") that leaked IP after docs cleanup.
- **SKILL.md env requirement** — Changed from `[ANTHROPIC_API_KEY]` to `[]` — plugin works with any provider (Anthropic, OpenAI, or Google), not just Anthropic.

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

### IP exposure reduction

- **README** — Verdict model table: removed score threshold ("20+") from DENY row, replaced with "Policy/high risk"
- **docs.html** — Removed `/radar/suggest` endpoint (reveals cross-tenant pattern mechanism) and sidebar link
- **docs.html** — Vela section: removed cross-tenant learning explanation (pattern accumulation, subscriber base growth)
- **docs.html** — T3 description: removed "cross-tenant patterns from every agent she watches"
- **docs.html** — Removed orphaned "Score ranges above are defaults..." line

### Known limitations

- `options` and `recommended` fields in HOLD results are `null` when no LLM key is configured (rules engine fallback)
- M7 (MEDIUM, upstream): radar-lite exposes internal LLM error messages in the `vela` field — requires fix in radar-lite
- M9 (MEDIUM, architectural): `override_deny` audit trail relies on agent-supplied `decidedBy` — inherent to agent-tool architecture
