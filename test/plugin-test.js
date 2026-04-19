/**
 * Plugin integration test
 *
 * Simulates OpenClaw's plugin API, registers all tools,
 * then exercises each one. Run with: node test/plugin-test.js
 */

import plugin from '../dist/index.js';

// ── Simulate OpenClaw's api.registerTool() ──────────────────────────

const tools = {};

const fakeApi = {
  registerTool(def) {
    tools[def.name] = def;
    console.log(`  registered: ${def.name}`);
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}`);
    failed++;
  }
}

// ── Run ─────────────────────────────────────────────────────────────

async function run() {
  console.log('\n=== 1. Plugin registration ===');
  await plugin.register(fakeApi);

  assert(tools.radar_assess, 'radar_assess registered');
  assert(tools.radar_strategy, 'radar_strategy registered');
  assert(tools.radar_reload, 'radar_reload registered');

  // ── radar_reload ────────────────────────────────────────────────
  console.log('\n=== 2. radar_reload ===');
  const reloadResult = await tools.radar_reload.execute({});
  assert(reloadResult.ok === true, 'reload returns ok: true');
  console.log('  result:', JSON.stringify(reloadResult));

  // ── radar_assess: low-risk read ─────────────────────────────────
  console.log('\n=== 3. radar_assess — low-risk data_read ===');
  const readResult = await tools.radar_assess.execute({
    action: 'Read the user preferences file',
    activityType: 'data_read',
    agentId: 'test-agent',
  });
  assert(readResult.status === 'PROCEED', `verdict is PROCEED (got ${readResult.status})`);
  assert(readResult.proceed === true, `proceed is true`);
  assert(typeof readResult.riskScore === 'number', `riskScore is a number (${readResult.riskScore})`);
  assert(typeof readResult.callId === 'string', `callId present: ${readResult.callId}`);
  console.log('  result:', JSON.stringify(readResult, null, 2));

  // ── radar_assess: high-risk action ──────────────────────────────
  console.log('\n=== 4. radar_assess — high-risk email_bulk ===');
  const bulkResult = await tools.radar_assess.execute({
    action: 'Send promotional email to 50000 subscribers in the marketing list',
    activityType: 'email_bulk',
    agentId: 'test-agent',
  });
  assert(bulkResult.status === 'HOLD' || bulkResult.status === 'DENY', `verdict is HOLD or DENY (got ${bulkResult.status})`);
  assert(bulkResult.proceed === false, `proceed is false`);
  assert(typeof bulkResult.callId === 'string', `callId present: ${bulkResult.callId}`);
  if (bulkResult.options) {
    assert(typeof bulkResult.options.avoid === 'string', 'has avoid option');
    assert(typeof bulkResult.options.accept === 'string', 'has accept option');
  }
  console.log('  result:', JSON.stringify(bulkResult, null, 2));

  // ── radar_assess: input validation — bad activityType ───────────
  console.log('\n=== 5. radar_assess — invalid activityType ===');
  const badType = await tools.radar_assess.execute({
    action: 'Do something',
    activityType: 'not_a_real_type',
  });
  assert(badType.error && badType.error.includes('Invalid activityType'), `rejects invalid type: ${badType.error}`);

  // ── radar_assess: input validation — empty action ───────────────
  console.log('\n=== 6. radar_assess — empty action ===');
  const emptyAction = await tools.radar_assess.execute({
    action: '',
    activityType: 'data_read',
  });
  assert(emptyAction.error && emptyAction.error.includes('non-empty'), `rejects empty action: ${emptyAction.error}`);

  // ── radar_assess: input validation — oversized action ───────────
  console.log('\n=== 7. radar_assess — oversized action ===');
  const longAction = await tools.radar_assess.execute({
    action: 'x'.repeat(5000),
    activityType: 'data_read',
  });
  assert(longAction.error && longAction.error.includes('maximum length'), `rejects oversized action: ${longAction.error}`);

  // ── radar_strategy: record decision ─────────────────────────────
  console.log('\n=== 8. radar_strategy — record accept decision ===');
  if (bulkResult.callId && (bulkResult.status === 'HOLD' || bulkResult.status === 'DENY')) {
    const stratResult = await tools.radar_strategy.execute({
      callId: bulkResult.callId,
      strategy: 'accept',
      reason: 'Test run — verifying strategy recording',
      decidedBy: 'test-runner',
    });
    assert(stratResult && !stratResult.error, 'strategy recorded without error');
    console.log('  result:', JSON.stringify(stratResult, null, 2));
  } else {
    console.log('  SKIP  no HOLD/DENY callId to test against');
  }

  // ── radar_strategy: invalid callId ──────────────────────────────
  console.log('\n=== 9. radar_strategy — invalid callId ===');
  try {
    const badCall = await tools.radar_strategy.execute({
      callId: 'ra_doesnotexist',
      strategy: 'accept',
    });
    // radar-lite may return an error object or throw
    const isError = badCall.error || badCall.status === 'error';
    assert(isError, `rejects unknown callId`);
    console.log('  result:', JSON.stringify(badCall));
  } catch (err) {
    assert(true, `throws on unknown callId: ${err.message}`);
  }

  // ── radar_assess: DENY verdict ───────────────────────────────────
  console.log('\n=== 10. radar_assess — DENY verdict (data_delete_bulk + irreversibility) ===');
  const denyResult = await tools.radar_assess.execute({
    action: 'Permanently delete all 200000 customer records from the production database with no backup, this action cannot be undone and is irreversible',
    activityType: 'data_delete_bulk',
    agentId: 'test-agent',
  });
  console.log(`  score: ${denyResult.riskScore}, status: ${denyResult.status}`);
  assert(denyResult.status === 'DENY' || denyResult.riskScore >= 18, `high risk score (${denyResult.riskScore}) — status: ${denyResult.status}`);
  assert(denyResult.proceed === false, `proceed is false`);
  console.log('  result:', JSON.stringify(denyResult, null, 2));

  // ── H1 fix: configure() receives correct key names ─────────────
  console.log('\n=== 11. H1 fix — configure() receives llmKey not apiKey ===');

  // Intercept radar.configure by re-importing with a fake env key
  // We read the compiled plugin source and check the property names directly
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const pluginSource = readFileSync(join(import.meta.dirname, '..', 'dist', 'index.js'), 'utf-8');

  const hasLlmProvider = pluginSource.includes('llmProvider');
  const hasLlmKey = pluginSource.includes('llmKey');
  const hasT2Key = pluginSource.includes('t2Key');
  // Verify the configure() call maps to correct property names:
  // llm.apiKey (internal) -> llmKey (sent to radar-lite)
  const mapsApiKeyToLlmKey = /llmKey:\s*llm\.apiKey/.test(pluginSource);

  assert(hasLlmProvider, 'compiled code uses llmProvider (not provider)');
  assert(hasLlmKey, 'compiled code uses llmKey (not apiKey)');
  assert(hasT2Key, 'compiled code uses t2Key (not t2ApiKey)');
  assert(mapsApiKeyToLlmKey, 'configure() maps llm.apiKey -> llmKey correctly');

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
