#!/usr/bin/env node
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { createRequire } from 'module';
import { safeReadFile, safeWriteFile } from '../dist/safe-fs.js';
import { OPENCLAW_MARKER, OPENCLAW_INSTRUCTION } from '../dist/instruction.js';

const require = createRequire(import.meta.url);
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

} else if (process.argv.includes('install')) {

// ── install ─────────────────────────────────────────────────────────

  // 0. Check radar-lite is installed and version-compatible
  const ownPkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  const requiredRange =
    ownPkg.peerDependencies?.['@essentianlabs/radar-lite'] ||
    ownPkg.dependencies?.['@essentianlabs/radar-lite'] ||
    '^0.3.0';
  const requiredMajor = requiredRange.match(/(\d+)\.(\d+)/);

  let installedVersion;
  try {
    const radarPkgPath = require.resolve('@essentianlabs/radar-lite/package.json', {
      paths: [process.cwd(), __dirname],
    });
    installedVersion = JSON.parse(readFileSync(radarPkgPath, 'utf-8')).version;
  } catch {
    try {
      await import('@essentianlabs/radar-lite');
      installedVersion = 'unknown';
    } catch {
      console.error(
        'Error: @essentianlabs/radar-lite is not installed.\n\n' +
        '  npm install @essentianlabs/radar-lite@latest\n'
      );
      process.exit(1);
    }
  }

  if (installedVersion !== 'unknown' && requiredMajor) {
    const [, reqMaj, reqMin] = requiredMajor;
    const installedMatch = installedVersion.match(/(\d+)\.(\d+)/);
    if (installedMatch) {
      const [, insMaj, insMin] = installedMatch;
      const compatible = insMaj === reqMaj && (reqMaj !== '0' ? true : insMin === reqMin);
      if (!compatible) {
        console.error(
          `Error: @essentianlabs/radar-lite version mismatch.\n` +
          `  Installed: ${installedVersion}\n` +
          `  Required:  ${requiredRange}\n\n` +
          `Update radar-lite:\n\n` +
          `  npm install @essentianlabs/radar-lite@latest\n`
        );
        process.exit(1);
      }
    }
  }

  // 1. Add instruction to ~/.claude/CLAUDE.md (via safe-fs)
  const claudeDir = join(homedir(), '.claude');
  const claudeMdPath = join(claudeDir, 'CLAUDE.md');

  mkdirSync(claudeDir, { recursive: true });

  let existing = safeReadFile(claudeMdPath);
  if (existing === null) existing = '';

  if (existing.includes(OPENCLAW_MARKER)) {
    const regex = new RegExp(`${OPENCLAW_MARKER}[\\s\\S]*?${OPENCLAW_MARKER}`, 'm');
    const updated = existing.replace(regex, OPENCLAW_INSTRUCTION);
    if (!safeWriteFile(claudeMdPath, updated)) {
      console.error('Failed to update ~/.claude/CLAUDE.md');
      process.exit(1);
    }
    console.log('Updated openclaw-radar instructions in ~/.claude/CLAUDE.md');
  } else {
    const separator = existing.length > 0 ? '\n\n' : '';
    if (!safeWriteFile(claudeMdPath, existing + separator + OPENCLAW_INSTRUCTION + '\n')) {
      console.error('Failed to write ~/.claude/CLAUDE.md');
      process.exit(1);
    }
    console.log('Added openclaw-radar instructions to ~/.claude/CLAUDE.md');
  }

  // 2. Remind about OpenClaw plugin config
  console.log('\nDone. openclaw-radar plugin installed.');
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

  console.log('Existing Claude Code sessions need to be restarted to pick up openclaw-radar.');
  process.exit(0);

} else if (process.argv.includes('uninstall')) {

// ── uninstall ───────────────────────────────────────────────────────

  const claudeMdPath = join(homedir(), '.claude', 'CLAUDE.md');
  const content = safeReadFile(claudeMdPath);

  if (content !== null && content.includes(OPENCLAW_MARKER)) {
    const regex = new RegExp(`\\n?\\n?${OPENCLAW_MARKER}[\\s\\S]*?${OPENCLAW_MARKER}\\n?`, 'm');
    const stripped = content.replace(regex, '').trim();
    const final = stripped + (stripped ? '\n' : '');
    if (!safeWriteFile(claudeMdPath, final)) {
      console.error('Failed to update ~/.claude/CLAUDE.md');
      process.exit(1);
    }
    console.log('Removed openclaw-radar instructions from ~/.claude/CLAUDE.md');
  }

  console.log('');
  console.log('Done. openclaw-radar plugin uninstalled.');
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
