/**
 * Unit tests for safe-fs and instruction modules.
 * Run with: node --test test/unit.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, mkdirSync, rmSync, symlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { safeReadFile, safeWriteFile } from '../dist/safe-fs.js';
import {
  OPENCLAW_MARKER,
  OPENCLAW_INSTRUCTION,
  extractCurrentBlock,
} from '../dist/instruction.js';

// ── instruction.js ──────────────────────────────────────────────────

describe('instruction module', () => {
  it('exports OPENCLAW_MARKER constant', () => {
    assert.strictEqual(OPENCLAW_MARKER, '<!-- OPENCLAW-RADAR -->');
  });

  it('OPENCLAW_INSTRUCTION starts and ends with marker', () => {
    assert.ok(OPENCLAW_INSTRUCTION.startsWith(OPENCLAW_MARKER));
    assert.ok(OPENCLAW_INSTRUCTION.trimEnd().endsWith(OPENCLAW_MARKER));
  });

  it('OPENCLAW_INSTRUCTION uses MUST language for HOLD', () => {
    assert.ok(OPENCLAW_INSTRUCTION.includes('MUST'));
    assert.ok(OPENCLAW_INSTRUCTION.includes('HOLD'));
    assert.ok(OPENCLAW_INSTRUCTION.includes('DENY'));
  });

  it('OPENCLAW_INSTRUCTION explicitly says MUST NOT pick strategy', () => {
    assert.ok(OPENCLAW_INSTRUCTION.includes('MUST NOT pick a strategy'));
  });

  it('extractCurrentBlock returns null when marker absent', () => {
    const result = extractCurrentBlock('# CLAUDE.md\n\nSome content here.');
    assert.strictEqual(result, null);
  });

  it('extractCurrentBlock extracts block when present', () => {
    const content = `# CLAUDE.md\n\n${OPENCLAW_INSTRUCTION}\n\nMore content.`;
    const result = extractCurrentBlock(content);
    assert.ok(result);
    assert.ok(result.includes(OPENCLAW_MARKER));
  });

  it('extractCurrentBlock handles content with the marker only', () => {
    const result = extractCurrentBlock(OPENCLAW_INSTRUCTION);
    assert.strictEqual(result.trim(), OPENCLAW_INSTRUCTION.trim());
  });
});

// ── safe-fs.js ──────────────────────────────────────────────────────

describe('safe-fs', () => {
  const testDir = join(tmpdir(), `openclaw-radar-test-${Date.now()}`);

  // Setup
  mkdirSync(testDir, { recursive: true });

  it('safeReadFile returns null for non-existent file', () => {
    const result = safeReadFile(join(testDir, 'nonexistent.txt'));
    assert.strictEqual(result, null);
  });

  it('safeReadFile reads regular file content', () => {
    const path = join(testDir, 'regular.txt');
    writeFileSync(path, 'hello world', 'utf-8');
    const result = safeReadFile(path);
    assert.strictEqual(result, 'hello world');
  });

  it('safeReadFile refuses to follow symlinks', () => {
    const target = join(testDir, 'target.txt');
    const link = join(testDir, 'link.txt');
    writeFileSync(target, 'sensitive data', 'utf-8');

    // Skip if symlinks not supported (Windows without admin)
    try {
      symlinkSync(target, link, 'file');
    } catch {
      return; // Skip test on platforms that block symlink creation
    }

    const result = safeReadFile(link);
    assert.strictEqual(result, null, 'should refuse to read through symlink');
  });

  it('safeReadFile refuses files larger than 1 MiB', () => {
    const path = join(testDir, 'big.txt');
    const big = 'x'.repeat(1024 * 1024 + 100); // 1 MiB + 100 bytes
    writeFileSync(path, big, 'utf-8');
    const result = safeReadFile(path);
    assert.strictEqual(result, null);
  });

  it('safeReadFile accepts files at the size cap', () => {
    const path = join(testDir, 'edge.txt');
    const atCap = 'x'.repeat(1024 * 1024); // exactly 1 MiB
    writeFileSync(path, atCap, 'utf-8');
    const result = safeReadFile(path);
    assert.strictEqual(result?.length, 1024 * 1024);
  });

  it('safeWriteFile writes new file', () => {
    const path = join(testDir, 'new-write.txt');
    const ok = safeWriteFile(path, 'fresh content');
    assert.strictEqual(ok, true);
    assert.strictEqual(safeReadFile(path), 'fresh content');
  });

  it('safeWriteFile overwrites existing regular file', () => {
    const path = join(testDir, 'overwrite.txt');
    writeFileSync(path, 'old', 'utf-8');
    const ok = safeWriteFile(path, 'new');
    assert.strictEqual(ok, true);
    assert.strictEqual(safeReadFile(path), 'new');
  });

  it('safeWriteFile refuses to write through symlinks', () => {
    const target = join(testDir, 'write-target.txt');
    const link = join(testDir, 'write-link.txt');
    writeFileSync(target, 'original', 'utf-8');

    try {
      symlinkSync(target, link, 'file');
    } catch {
      return; // Skip on platforms blocking symlink creation
    }

    const ok = safeWriteFile(link, 'malicious overwrite');
    assert.strictEqual(ok, false, 'should refuse to write through symlink');
    // Confirm target was NOT overwritten
    assert.strictEqual(safeReadFile(target), 'original');
  });

  // Cleanup
  it('cleanup', () => {
    rmSync(testDir, { recursive: true, force: true });
    assert.strictEqual(existsSync(testDir), false);
  });
});
