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

test('activation payload accepts only Extension-owned packaged feature targets', () => {
  assert.deepEqual(contract.assertPayload(payload()), payload());
  assert.equal(
    contract.assertPayload(payload({
      pluginId: 'report-reminders-online',
      targetPluginId: 'report-reminders'
    })).enabled,
    true
  );
  assert.equal(
    contract.assertPayload(payload({
      pluginId: 'report-library-online',
      targetPluginId: 'report-library'
    })).enabled,
    true
  );
});

test('activation payload rejects unknown fields, targets and loose booleans', () => {
  assert.throws(() => contract.assertPayload(payload({ approved: true })), /unknown field/);
  assert.throws(
    () => contract.assertPayload(payload({ targetPluginId: 'report-backups' })),
    /not remotely activatable/
  );
  assert.throws(() => contract.assertPayload(payload({ enabled: 'true' })), /strict boolean/);
});
