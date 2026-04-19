#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── --version / -v ──────────────────────────────────────────────────

if (process.argv.includes('--version') || process.argv.includes('-v')) {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  console.log(`openclaw-radar v${pkg.version}`);
  process.exit(0);
}

// ── --dashboard ─────────────────────────────────────────────────────

if (process.argv.includes('--dashboard')) {
  console.log('Starting RADAR dashboard...');
  const { spawn } = await import('child_process');
  spawn('npx', ['@essentianlabs/radar-lite', 'dashboard'], {
    stdio: 'inherit',
    shell: true,
  });
  // Don't exit — dashboard keeps running
} else if (process.argv.includes('install')) {

// ── install ─────────────────────────────────────────────────────────

  const MARKER = '<!-- OPENCLAW-RADAR -->';
  const INSTRUCTION = `${MARKER}
## RADAR — Risk Assessment

Call \`radar_assess\` before every task. It must be your first tool call.
If the verdict is PROCEED, continue. If HOLD or DENY, stop and explain the verdict to the user.
${MARKER}`;

  // 1. Add instruction to ~/.claude/CLAUDE.md
  const claudeDir = join(homedir(), '.claude');
  const claudeMdPath = join(claudeDir, 'CLAUDE.md');

  mkdirSync(claudeDir, { recursive: true });

  let existing = '';
  if (existsSync(claudeMdPath)) {
    existing = readFileSync(claudeMdPath, 'utf-8');
  }

  if (existing.includes(MARKER)) {
    // Replace existing block
    const regex = new RegExp(`${MARKER}[\\s\\S]*?${MARKER}`, 'm');
    const updated = existing.replace(regex, INSTRUCTION);
    writeFileSync(claudeMdPath, updated, 'utf-8');
    console.log('Updated RADAR instructions in ~/.claude/CLAUDE.md');
  } else {
    // Append
    const separator = existing.length > 0 ? '\n\n' : '';
    writeFileSync(claudeMdPath, existing + separator + INSTRUCTION + '\n', 'utf-8');
    console.log('Added RADAR instructions to ~/.claude/CLAUDE.md');
  }

  // 2. Remind about OpenClaw plugin config
  console.log('\nDone. RADAR plugin installed.');
  console.log('');
  console.log('To enable in OpenClaw, add to your openclaw config:');
  console.log('');
  console.log('  {');
  console.log('    "plugins": {');
  console.log('      "entries": {');
  console.log('        "openclaw-radar": { "enabled": true }');
  console.log('      }');
  console.log('    }');
  console.log('  }');
  console.log('');

  // 3. Check for LLM key
  const hasKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!hasKey) {
    console.log('WARNING: No LLM API key found in environment.');
    console.log('RADAR will work (rules engine), but Vela Lite reasoning requires a key.');
    console.log('Configure via: npx @essentianlabs/radar-lite dashboard');
    console.log('');
  }

  console.log('Existing Claude Code sessions need to be restarted to pick up RADAR.');
  process.exit(0);

} else if (process.argv.includes('uninstall')) {

// ── uninstall ───────────────────────────────────────────────────────

  const MARKER = '<!-- OPENCLAW-RADAR -->';

  // 1. Remove instruction from CLAUDE.md
  const claudeMdPath = join(homedir(), '.claude', 'CLAUDE.md');

  if (existsSync(claudeMdPath)) {
    let content = readFileSync(claudeMdPath, 'utf-8');
    if (content.includes(MARKER)) {
      const regex = new RegExp(`\\n?\\n?${MARKER}[\\s\\S]*?${MARKER}\\n?`, 'm');
      content = content.replace(regex, '').trim();
      writeFileSync(claudeMdPath, content + (content ? '\n' : ''), 'utf-8');
      console.log('Removed RADAR instructions from ~/.claude/CLAUDE.md');
    }
  }

  console.log('');
  console.log('Done. RADAR plugin uninstalled.');
  console.log('Remember to also remove "openclaw-radar" from your OpenClaw plugin config.');
  process.exit(0);

} else {

// ── No command ──────────────────────────────────────────────────────

  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  console.log(`openclaw-radar v${pkg.version}`);
  console.log('');
  console.log('Usage:');
  console.log('  openclaw-radar install      Add RADAR instructions to ~/.claude/CLAUDE.md');
  console.log('  openclaw-radar uninstall    Remove RADAR instructions from ~/.claude/CLAUDE.md');
  console.log('  openclaw-radar --dashboard  Open the RADAR configuration dashboard');
  console.log('  openclaw-radar --version    Print version');
  process.exit(0);
}
