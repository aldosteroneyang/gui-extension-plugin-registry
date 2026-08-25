'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const contract = require('../src/declarative-block-contract');

function payload(overrides = {}) {
  return {
    schemaVersion: 1,
    pluginId: 'synthetic-options-help',
    version: '1.0.0',
    blocks: [{
      id: 'network-proof',
      type: 'notice',
      title: 'Online functionality active',
      body: 'This remains bounded plain text.',
      tone: 'success'
    }],
    ...overrides
  };
}

test('declarative contract accepts only bounded text notice blocks', () => {
  const result = contract.validatePayload(payload());
  assert.equal(result.success, true, result.error && result.error.message);
  assert.equal(result.value.blocks[0].type, 'notice');
});

test('declarative contract rejects self-attestation and executable fields', () => {
  assert.throws(() => contract.assertPayload({ ...payload(), approved: true }), /unknown field/);
  const unsafe = payload();
  unsafe.blocks[0].script = 'run()';
  assert.throws(() => contract.assertPayload(unsafe), /unknown field/);
});
