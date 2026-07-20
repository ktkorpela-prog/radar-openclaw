import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { checkSelfInstall } from '../preinstall-guard.js';

// v0.2.3 — coverage for the self-install trap detector.
// Mirrors radar-lite v0.4.5 tests; only OWN_NAME differs.

const OWN_NAME = '@essentianlabs/openclaw-radar';

function stubFs(files = {}) {
  const normalised = {};
  for (const [k, v] of Object.entries(files)) {
    const idx = k.lastIndexOf('/');
    if (idx >= 0) {
      normalised[join(k.slice(0, idx), k.slice(idx + 1))] = v;
    } else {
      normalised[k] = v;
    }
  }
  return {
    readJsonExists: (p) => Object.prototype.hasOwnProperty.call(normalised, p),
    readJson: (p) => {
      if (!Object.prototype.hasOwnProperty.call(normalised, p)) {
        throw new Error(`ENOENT: ${p}`);
      }
      return normalised[p];
    }
  };
}

describe('v0.2.3 preinstall-guard — checkSelfInstall', () => {

  it('BLOCKS: npm install openclaw-radar from inside openclaw-radar dev repo', () => {
    const result = checkSelfInstall({
      cwd: '/home/karin/radar-openclaw/node_modules/@essentianlabs/openclaw-radar',
      initCwd: '/home/karin/radar-openclaw',
      ...stubFs({
        '/home/karin/radar-openclaw/package.json': JSON.stringify({ name: OWN_NAME })
      })
    });
    assert.equal(result, true, 'should block the self-install trap');
  });

  it('ALLOWS: consumer install in their own project', () => {
    const result = checkSelfInstall({
      cwd: '/home/joe/myapp/node_modules/@essentianlabs/openclaw-radar',
      initCwd: '/home/joe/myapp',
      ...stubFs({
        '/home/joe/myapp/package.json': JSON.stringify({ name: 'myapp' })
      })
    });
    assert.equal(result, false);
  });

  it('ALLOWS: npm install (no args) in dev repo — cwd === initCwd', () => {
    const result = checkSelfInstall({
      cwd: '/home/karin/radar-openclaw',
      initCwd: '/home/karin/radar-openclaw',
      ...stubFs({
        '/home/karin/radar-openclaw/package.json': JSON.stringify({ name: OWN_NAME })
      })
    });
    assert.equal(result, false);
  });

  it('ALLOWS: no INIT_CWD (manual node invocation)', () => {
    const result = checkSelfInstall({ cwd: '/x', initCwd: undefined, ...stubFs({}) });
    assert.equal(result, false);
  });

  it('ALLOWS: parent package.json missing', () => {
    const result = checkSelfInstall({
      cwd: '/home/joe/myapp/node_modules/@essentianlabs/openclaw-radar',
      initCwd: '/home/joe/myapp',
      ...stubFs({})
    });
    assert.equal(result, false);
  });

  it('ALLOWS: malformed parent package.json', () => {
    const result = checkSelfInstall({
      cwd: '/home/joe/myapp/node_modules/@essentianlabs/openclaw-radar',
      initCwd: '/home/joe/myapp',
      ...stubFs({ '/home/joe/myapp/package.json': '{not valid' })
    });
    assert.equal(result, false);
  });

  it('ALLOWS: near-miss names (radar-openclaw unscoped, forks, etc.)', () => {
    for (const name of ['openclaw-radar', '@fork/openclaw-radar', '@essentianlabs/openclaw', '']) {
      const result = checkSelfInstall({
        cwd: '/home/joe/myapp/node_modules/@essentianlabs/openclaw-radar',
        initCwd: '/home/joe/myapp',
        ...stubFs({ '/home/joe/myapp/package.json': JSON.stringify({ name }) })
      });
      assert.equal(result, false, `name "${name}" must not trigger the guard`);
    }
  });
});
