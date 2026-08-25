'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { scanPublicBoundary } = require('../scripts/check-public-boundary');

test('public repository contains no recognized private material', () => {
  assert.deepEqual(scanPublicBoundary(), []);
});
