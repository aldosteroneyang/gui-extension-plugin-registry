'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const contract = require('../src/plugin-activation-contract');

function payload(overrides = {}) {
  return {
    schemaVersion: 1,
    pluginId: 'worklist-sort-online',
    version: '1.0.0',
    targetPluginId: 'worklist-sort',
    enabled: true,
    ...overrides
  };
}

test('activation payload accepts only the Extension-owned worklist target', () => {
  assert.deepEqual(contract.assertPayload(payload()), payload());
});

test('activation payload rejects unknown fields, targets and loose booleans', () => {
  assert.throws(() => contract.assertPayload(payload({ approved: true })), /unknown field/);
  assert.throws(
    () => contract.assertPayload(payload({ targetPluginId: 'report-reminders' })),
    /not remotely activatable/
  );
  assert.throws(() => contract.assertPayload(payload({ enabled: 'true' })), /strict boolean/);
});
