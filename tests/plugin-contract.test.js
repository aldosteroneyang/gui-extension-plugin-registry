'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const contract = require('../src/plugin-contract');

function entrypoint(overrides = {}) {
  return {
    capabilities: [],
    messageActions: [],
    alarmNames: [],
    lifecycle: [],
    provides: [],
    consumes: [],
    ...overrides
  };
}

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    contractVersion: 1,
    id: 'synthetic-plugin',
    version: '1.0.0',
    kind: 'declarative',
    entrypoints: {
      content: entrypoint({ capabilities: ['ui.webnm'] })
    },
    storage: [],
    ...overrides
  };
}

test('all hard rules have executable implementations', () => {
  assert.equal(new Set(contract.HARD_RULES.map(rule => rule.id)).size, contract.HARD_RULES.length);
  contract.HARD_RULES.forEach(rule => {
    assert.equal(typeof contract.RULE_CHECKS[rule.check], 'function', rule.id);
  });
});

test('strict declarative manifest passes', () => {
  assert.deepEqual(contract.validateManifest(manifest()), { success: true, failures: [] });
});

test('self-attestation cannot bypass closed-schema or remote-code rules', () => {
  const claimed = contract.validateManifest({ ...manifest(), checklistPassed: true });
  assert.equal(claimed.success, false);
  assert.ok(claimed.failures.some(failure => failure.ruleId === 'PLUGIN-BASE-001'));

  const executable = contract.validateManifest(manifest({
    kind: 'remote-web',
    entrypoints: {
      content: entrypoint({
        capabilities: ['ui.remote-surface'],
        messageActions: ['runDownloadedCode']
      })
    }
  }));
  assert.equal(executable.success, false);
  assert.ok(executable.failures.some(failure => failure.ruleId === 'PLUGIN-KIND-001'));
});
