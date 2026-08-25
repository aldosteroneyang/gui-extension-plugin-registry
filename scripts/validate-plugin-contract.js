#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const contract = require('../src/plugin-contract');

function parseArgs(argv) {
  const options = {};
  const allowed = new Map([
    ['--manifest', 'manifestPath'],
    ['--expected-id', 'expectedId'],
    ['--expected-kind', 'expectedKind']
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = allowed.get(argv[index]);
    if (!key) throw new Error(`unknown option: ${argv[index]}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${argv[index]}`);
    options[key] = value;
    index += 1;
  }
  if (!options.manifestPath) throw new Error('--manifest is required');
  return options;
}

function readManifest(manifestPath) {
  const absolutePath = path.resolve(manifestPath);
  let raw;
  try {
    raw = fs.readFileSync(absolutePath, 'utf8');
  } catch (_error) {
    throw new Error(`cannot read plugin manifest: ${absolutePath}`);
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    throw new Error(`plugin manifest is not valid JSON: ${absolutePath}`);
  }
}

function validateExternalManifest(options) {
  const manifest = readManifest(options.manifestPath);
  const result = contract.validateManifest(manifest);
  if (!result.success) {
    const first = result.failures[0];
    throw new Error(`${first.ruleId} ${first.path || manifest.id || 'manifest'}: ${first.message}`);
  }
  if (!['declarative', 'remote-web'].includes(manifest.kind)) {
    throw new Error(`external Registry does not accept plugin kind: ${manifest.kind}`);
  }
  if (options.expectedId && manifest.id !== options.expectedId) {
    throw new Error(`plugin id mismatch: expected ${options.expectedId}; received ${manifest.id}`);
  }
  if (options.expectedKind && manifest.kind !== options.expectedKind) {
    throw new Error(`plugin kind mismatch: expected ${options.expectedKind}; received ${manifest.kind}`);
  }
  return manifest;
}

function main(argv = process.argv.slice(2)) {
  try {
    const manifest = validateExternalManifest(parseArgs(argv));
    console.log(
      `External plugin contract OK: id=${manifest.id}; kind=${manifest.kind}; hardRules=${contract.HARD_RULES.length}`
    );
  } catch (error) {
    console.error(`External plugin contract failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  main,
  parseArgs,
  readManifest,
  validateExternalManifest
};
