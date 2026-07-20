# Security Policy

## Supported Versions

`@essentianlabs/openclaw-radar` is currently BETA and released as `0.x.y`.
Security fixes are applied to the latest published version. Older versions
are not backported.

| Version | Support status |
|---------|---------------|
| `0.2.x` (current) | Actively supported — bug + security fixes |
| `< 0.2.0` | Unsupported |

Dependency/peer: `@essentianlabs/radar-lite ^0.3.1 || ^0.4.0` (v0.4.6+ recommended).
Vulnerabilities in radar-lite should be reported to that project's SECURITY
policy: <https://github.com/ktkorpela-prog/radar-lite/blob/master/SECURITY.md>.

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security-sensitive reports.**

Two private channels:

1. **GitHub Private Vulnerability Reporting** (preferred)
   Open a private advisory at: <https://github.com/ktkorpela-prog/radar-openclaw/security/advisories/new>

2. **Email**
   `ktkorpela@essentianlabs.com` with subject line prefixed `[openclaw-radar security]`.
   Describe: (a) what you found, (b) reproduction steps, (c) potential impact,
   (d) suggested mitigation.

## Response Commitment

`@essentianlabs/openclaw-radar` is maintained by a single operator (unfunded
BETA). No formal SLA. Realistic response profile:

- **Acknowledgement:** within 72 hours
- **Triage:** within 7 days
- **Fix + patch release:** timeline scales with severity

## In Scope

- The `openclaw-radar` npm package itself (all `src/*` TypeScript, compiled `dist/*`, and `bin/*` code)
- The OpenClaw plugin manifest (`openclaw.plugin.json`) — schema, permissions
- The `skills/*` bundled skill definitions
- The `safe-fs.ts` file operations — symlink protection, size limits
- The bundled radar-lite peer-dep resolution

## Out of Scope

- Vulnerabilities in the underlying `@essentianlabs/radar-lite` package — report there
- Vulnerabilities in the OpenClaw runtime itself — report to OpenClaw
- Model-tier decisions and prompt engineering in radar-lite — report there

## Disclosure Practices

Coordinated disclosure preferred:

1. Report privately (channels above)
2. Maintainer confirms + provides ETA
3. Fix published as a patch release + `npm audit` advisory registered
4. Reporter credited in the CHANGELOG unless anonymity requested
5. Public disclosure after users have had a reasonable window to upgrade

## Known Non-Issues (Documented)

- **openclaw-radar does NOT phone home to EssentianLabs.** The only outbound
  network call is the daily update-check against `registry.npmjs.org`
  (opt-out via `UPDATE_CHECK=false`).
- **BETA classification.** Not recommended for enterprise or production use
  without independent security review.
- **Advisory, not enforcement.** RADAR verdicts are advisory to the calling
  OpenClaw agent. Enforcement is the caller's responsibility.
