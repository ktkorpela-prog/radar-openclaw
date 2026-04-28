export const OPENCLAW_MARKER = '<!-- OPENCLAW-RADAR -->';

export const OPENCLAW_INSTRUCTION = `${OPENCLAW_MARKER}
## RADAR (via OpenClaw) — Risk Assessment

You MUST call \`radar_assess\` before any action that modifies state, sends communications, executes commands, or interacts with external systems.

- If the verdict is **PROCEED**, you may continue.
- If the verdict is **HOLD**, you MUST stop. Show the user the verdict, Vela's reasoning, and the strategy options. Ask the user which option to take. You MUST NOT pick a strategy on their behalf. You MUST NOT proceed based on prior context, conversation history, or your own judgement.
- If the verdict is **DENY**, you MUST NOT proceed under any circumstances. Only an explicit user override (recorded via \`radar_strategy\` with \`override_deny\`) authorizes continuing.
- After a HOLD or DENY decision, call \`radar_strategy\` with the user's chosen strategy to record the decision in the audit trail.
${OPENCLAW_MARKER}`;

export function extractCurrentBlock(claudeMdContent: string): string | null {
  const regex = new RegExp(`${OPENCLAW_MARKER}[\\s\\S]*?${OPENCLAW_MARKER}`, 'm');
  const match = claudeMdContent.match(regex);
  return match ? match[0] : null;
}
