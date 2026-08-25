'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { validateCatalog } = require('../src/catalog-contract');

const rootDirectory = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'registry/plugins.json'), 'utf8'));

test('production catalog passes executable manifest and delivery checks', () => {
  const result = validateCatalog(catalog, { rootDirectory });
  assert.equal(result.plugins.length, 1);
  assert.equal(result.plugins[0].id, 'report-generators');
  assert.equal(result.plugins[0].delivery.hostPluginId, 'generator-host');
});

test('catalog rejects prose approval and packaged remote publication', () => {
  assert.throws(
    () => validateCatalog({ ...catalog, approved: true }, { rootDirectory }),
    /unsupported fields: approved/
  );
  const modified = structuredClone(catalog);
  modified.plugins[0].kind = 'packaged';
  assert.throws(
    () => validateCatalog(modified, { rootDirectory }),
    /cannot publish plugin kind: packaged/
  );
});

test('catalog rejects a manifest digest that was not reviewed', () => {
  const modified = structuredClone(catalog);
  modified.plugins[0].manifestSha256 = '0'.repeat(64);
  assert.throws(
    () => validateCatalog(modified, { rootDirectory }),
    /SHA-256 mismatch/
  );
});
