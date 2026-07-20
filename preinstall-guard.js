#!/usr/bin/env node
// v0.2.3 — self-install guard.
//
// Prevents `npm install @essentianlabs/openclaw-radar` from succeeding
// when run from inside the openclaw-radar dev repo itself — same trap
// pattern as radar-lite v0.4.5 preinstall guard. Silently adds a
// self-dependency to package.json + drops a stale copy in
// node_modules, then confuses future `npm audit fix` runs.
//
// Design mirrors radar-lite/preinstall-guard.js. See v0.4.5 changelog
// for rationale + behaviour matrix. Only OWN_NAME differs.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OWN_NAME = '@essentianlabs/openclaw-radar';

/**
 * Decide whether the preinstall guard should fire.
 *
 * @param {object} args
 * @param {string} args.cwd
 * @param {string|undefined} args.initCwd
 * @param {(p: string) => boolean} args.readJsonExists
 * @param {(p: string) => string} args.readJson
 * @returns {boolean} true if guard should block, false to allow
 */
export function checkSelfInstall({ cwd, initCwd, readJsonExists, readJson }) {
  if (!initCwd) return false;
  if (resolve(cwd) === resolve(initCwd)) return false;

  const parentPkgPath = join(initCwd, 'package.json');
  if (!readJsonExists(parentPkgPath)) return false;

  let parentPkg;
  try {
    parentPkg = JSON.parse(readJson(parentPkgPath));
  } catch (e) {
    return false;
  }

  return parentPkg && parentPkg.name === OWN_NAME;
}

const runningDirectly = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
                        import.meta.url.endsWith('/preinstall-guard.js');

if (runningDirectly) {
  const shouldBlock = checkSelfInstall({
    cwd: process.cwd(),
    initCwd: process.env.INIT_CWD,
    readJsonExists: existsSync,
    readJson: (p) => readFileSync(p, 'utf-8')
  });

  if (shouldBlock) {
    console.error('');
    console.error('  ✗ Refusing to install @essentianlabs/openclaw-radar as a self-dependency.');
    console.error('');
    console.error('    You appear to be running `npm install @essentianlabs/openclaw-radar`');
    console.error('    from inside the openclaw-radar dev repository itself. This adds');
    console.error('    openclaw-radar as a dependency of itself in package.json — a broken');
    console.error('    package state that also traps future `npm audit fix` runs.');
    console.error('');
    console.error('    If you meant to install dev dependencies for local development:');
    console.error('      npm install                              (no arguments)');
    console.error('');
    console.error('    If you meant to install into a different project:');
    console.error('      cd /path/to/consumer-project');
    console.error('      npm install @essentianlabs/openclaw-radar');
    console.error('');
    process.exit(1);
  }
}
