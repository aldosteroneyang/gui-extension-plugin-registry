#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const contract = require('../src/plugin-contract');
const blockContract = require('../src/declarative-block-contract');
const { validateCatalog } = require('../src/catalog-contract');

const REQUEST_TIMEOUT_MS = 15000;

function readCatalog(catalogPath) {
  const absolutePath = path.resolve(catalogPath);
  let raw;
  try {
    raw = fs.readFileSync(absolutePath, 'utf8');
  } catch (_error) {
    throw new Error(`cannot read catalog: ${absolutePath}`);
  }
  try {
    return validateCatalog(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`catalog is not valid JSON: ${absolutePath}`);
    throw error;
  }
}

async function fetchRemoteManifest(entry, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const requestUrl = new URL(entry.manifestUrl);
    requestUrl.searchParams.set('_', String(Date.now()));
    const response = await fetchImpl(requestUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gui-extension-plugin-registry'
      },
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = Buffer.from(await response.arrayBuffer());
    const digest = crypto.createHash('sha256').update(raw).digest('hex');
    if (digest !== entry.manifestSha256) throw new Error('remote manifest SHA-256 mismatch');
    const manifest = JSON.parse(raw.toString('utf8'));
    const result = contract.validateManifest(manifest);
    if (!result.success) {
      const first = result.failures[0];
      throw new Error(`${first.ruleId}: ${first.message}`);
    }
    if (manifest.id !== entry.id || manifest.version !== entry.version || manifest.kind !== entry.kind) {
      throw new Error('remote manifest identity mismatch');
    }
    if (entry.kind === 'declarative') {
      const resourceUrl = new URL(entry.delivery.resourceUrl);
      resourceUrl.searchParams.set('_', String(Date.now()));
      const resourceResponse = await fetchImpl(resourceUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'gui-extension-plugin-registry'
        },
        cache: 'no-store',
        signal: controller.signal
      });
      if (!resourceResponse.ok) throw new Error(`resource HTTP ${resourceResponse.status}`);
      const resourceRaw = Buffer.from(await resourceResponse.arrayBuffer());
      const resourceDigest = crypto.createHash('sha256').update(resourceRaw).digest('hex');
      if (resourceDigest !== entry.delivery.resourceSha256) {
        throw new Error('remote resource SHA-256 mismatch');
      }
      const payload = blockContract.assertPayload(JSON.parse(resourceRaw.toString('utf8')));
      if (payload.pluginId !== entry.id || payload.version !== entry.version) {
        throw new Error('remote declarative resource identity mismatch');
      }
    }
    return manifest;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main(argv = process.argv.slice(2)) {
  try {
    const checkRemote = argv.includes('--check-remote');
    const values = argv.filter(value => value !== '--check-remote');
    if (values.length !== 1) {
      throw new Error('usage: node scripts/validate-catalog.js <catalog-path> [--check-remote]');
    }
    const catalog = readCatalog(values[0]);
    if (checkRemote) {
      for (const entry of catalog.plugins) await fetchRemoteManifest(entry);
    }
    console.log(
      `Plugin catalog OK: entries=${catalog.plugins.length}; remote=${checkRemote ? catalog.plugins.length : 0}`
    );
  } catch (error) {
    console.error(`Plugin catalog failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  fetchRemoteManifest,
  main,
  readCatalog
};
