'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const script = path.resolve(__dirname, '..', 'scripts', 'validate-plugin-contract.js');
const manifest = path.resolve(__dirname, '..', 'plugins', 'report-generators', 'plugin-manifest.json');

test('external plugin CLI runs the executable hard rules', () => {
  const result = spawnSync(process.execPath, [
    script,
    '--manifest', manifest,
    '--expected-id', 'report-generators',
    '--expected-kind', 'remote-web'
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /hardRules=8/);
});

test('external plugin CLI rejects unknown self-attestation options', () => {
  const result = spawnSync(process.execPath, [script, '--approved', 'true'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown option/);
});
