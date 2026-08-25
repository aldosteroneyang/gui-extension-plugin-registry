'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const pluginContract = require('./plugin-contract');
const activationContract = require('./plugin-activation-contract');
const blockContract = require('./declarative-block-contract');

const CATALOG_SCHEMA_VERSION = 1;
const PUBLIC_MANIFEST_BASE = 'https://raw.githubusercontent.com/aldosteroneyang/gui-extension-plugin-registry/main/';
const TOP_LEVEL_KEYS = new Set(['schemaVersion', 'contractVersion', 'registryVersion', 'plugins']);
const ENTRY_KEYS = new Set([
  'id',
  'version',
  'kind',
  'manifestPath',
  'manifestUrl',
  'manifestSha256',
  'delivery'
]);
const DELIVERY_KEYS = new Set(['hostPluginId', 'resourceUrl', 'resourceSha256']);
const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertClosedSchema(value, allowedKeys, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
  const extraKeys = Object.keys(value).filter(key => !allowedKeys.has(key));
  if (extraKeys.length > 0) {
    throw new Error(`${label} includes unsupported fields: ${extraKeys.sort().join(', ')}`);
  }
}

function validateHttpsUrl(value, label) {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new Error(`${label} must be a bounded HTTPS URL`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    throw new Error(`${label} must be a valid HTTPS URL`);
  }
  if (parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.port
    || parsed.search
    || parsed.hash) {
    throw new Error(`${label} must use HTTPS without credentials, custom port, query, or fragment`);
  }
  return parsed.toString();
}

function readJsonFile(rootDirectory, relativePath, label) {
  const absoluteRoot = path.resolve(rootDirectory);
  const absolutePath = path.resolve(absoluteRoot, relativePath);
  if (!absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error(`${label} escapes repository: ${relativePath}`);
  }
  let raw;
  try {
    raw = fs.readFileSync(absolutePath);
  } catch (_error) {
    throw new Error(`cannot read ${label}: ${relativePath}`);
  }
  let value;
  try {
    value = JSON.parse(raw.toString('utf8'));
  } catch (_error) {
    throw new Error(`${label} is not valid JSON: ${relativePath}`);
  }
  return { value, raw };
}

function readManifest(rootDirectory, manifestPath) {
  const expectedPrefix = 'plugins/';
  if (typeof manifestPath !== 'string'
    || !manifestPath.startsWith(expectedPrefix)
    || !/^plugins\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/plugin-manifest\.json$/.test(manifestPath)) {
    throw new Error(`invalid catalog manifestPath: ${manifestPath}`);
  }
  const { value, raw } = readJsonFile(rootDirectory, manifestPath, 'catalog manifest');
  return { manifest: value, raw };
}

function declarativeResourceDefinition(hostPluginId) {
  if (hostPluginId === 'declarative-block-host') {
    return { fileName: 'blocks.json', assertPayload: blockContract.assertPayload };
  }
  if (hostPluginId === activationContract.ACTIVATION_HOST_PLUGIN_ID) {
    return { fileName: 'activation.json', assertPayload: activationContract.assertPayload };
  }
  throw new Error(`unsupported declarative delivery host: ${hostPluginId}`);
}

function validateCatalog(catalog, options = {}) {
  const rootDirectory = options.rootDirectory || path.resolve(__dirname, '..');
  assertClosedSchema(catalog, TOP_LEVEL_KEYS, 'catalog');
  if (catalog.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    throw new Error(`unsupported catalog schemaVersion: ${catalog.schemaVersion}`);
  }
  if (catalog.contractVersion !== pluginContract.PLUGIN_CONTRACT_VERSION) {
    throw new Error(`unsupported catalog contractVersion: ${catalog.contractVersion}`);
  }
  if (typeof catalog.registryVersion !== 'string' || !SEMVER_PATTERN.test(catalog.registryVersion)) {
    throw new Error('catalog registryVersion must use MAJOR.MINOR.PATCH');
  }
  if (!Array.isArray(catalog.plugins) || catalog.plugins.length === 0) {
    throw new Error('catalog plugins must be a non-empty array');
  }

  const seenIds = new Set();
  const seenManifestUrls = new Set();
  const seenActivationTargets = new Set();
  const manifests = [];
  const plugins = catalog.plugins.map(entry => {
    assertClosedSchema(entry, ENTRY_KEYS, 'catalog plugin');
    assertClosedSchema(entry.delivery, DELIVERY_KEYS, 'catalog delivery');
    if (typeof entry.id !== 'string' || entry.id.length > 80 || !PLUGIN_ID_PATTERN.test(entry.id)) {
      throw new Error(`invalid catalog plugin id: ${entry.id}`);
    }
    if (typeof entry.version !== 'string' || !SEMVER_PATTERN.test(entry.version)) {
      throw new Error(`invalid catalog plugin version: ${entry.version}`);
    }
    if (!['declarative', 'remote-web'].includes(entry.kind)) {
      throw new Error(`catalog cannot publish plugin kind: ${entry.kind}`);
    }
    if (seenIds.has(entry.id)) throw new Error(`duplicate catalog plugin id: ${entry.id}`);
    seenIds.add(entry.id);

    const { manifest, raw } = readManifest(rootDirectory, entry.manifestPath);
    const manifestResult = pluginContract.validateManifest(manifest);
    if (!manifestResult.success) {
      const first = manifestResult.failures[0];
      throw new Error(`${first.ruleId} ${entry.id}: ${first.message}`);
    }
    if (manifest.id !== entry.id || manifest.version !== entry.version || manifest.kind !== entry.kind) {
      throw new Error(`catalog identity does not match manifest: ${entry.id}`);
    }
    const expectedManifestPath = `plugins/${entry.id}/plugin-manifest.json`;
    if (entry.manifestPath !== expectedManifestPath) {
      throw new Error(`catalog manifestPath must match plugin id: ${entry.id}`);
    }
    const expectedManifestUrl = `${PUBLIC_MANIFEST_BASE}${entry.manifestPath}`;
    if (validateHttpsUrl(entry.manifestUrl, 'catalog manifest URL') !== expectedManifestUrl) {
      throw new Error(`catalog manifest URL is not canonical: ${entry.id}`);
    }
    if (seenManifestUrls.has(entry.manifestUrl)) {
      throw new Error(`duplicate catalog manifest URL: ${entry.manifestUrl}`);
    }
    seenManifestUrls.add(entry.manifestUrl);
    const digest = crypto.createHash('sha256').update(raw).digest('hex');
    if (!SHA256_PATTERN.test(entry.manifestSha256) || entry.manifestSha256 !== digest) {
      throw new Error(`catalog manifest SHA-256 mismatch: ${entry.id}`);
    }

    if (typeof entry.delivery.hostPluginId !== 'string'
      || entry.delivery.hostPluginId.length > 80
      || !PLUGIN_ID_PATTERN.test(entry.delivery.hostPluginId)
      || entry.delivery.hostPluginId === entry.id) {
      throw new Error(`invalid packaged delivery host: ${entry.id}`);
    }
    const resourceUrl = validateHttpsUrl(entry.delivery.resourceUrl, 'catalog resource URL');
    const capabilities = Object.values(manifest.entrypoints)
      .flatMap(entrypoint => entrypoint.capabilities);
    if (entry.kind === 'remote-web' && !capabilities.includes('ui.remote-surface')) {
      throw new Error(`remote-web plugin requires ui.remote-surface: ${entry.id}`);
    }
    if (entry.kind === 'declarative') {
      const definition = declarativeResourceDefinition(entry.delivery.hostPluginId);
      const resourcePath = `plugins/${entry.id}/${definition.fileName}`;
      if (resourceUrl !== `${PUBLIC_MANIFEST_BASE}${resourcePath}`) {
        throw new Error(`declarative resource URL is not canonical: ${entry.id}`);
      }
      const { value: payload, raw: resourceRaw } = readJsonFile(
        rootDirectory,
        resourcePath,
        'declarative resource'
      );
      const resourceDigest = crypto.createHash('sha256').update(resourceRaw).digest('hex');
      if (!SHA256_PATTERN.test(entry.delivery.resourceSha256)
        || entry.delivery.resourceSha256 !== resourceDigest) {
        throw new Error(`declarative resource SHA-256 mismatch: ${entry.id}`);
      }
      const normalizedPayload = definition.assertPayload(payload);
      if (normalizedPayload.pluginId !== entry.id || normalizedPayload.version !== entry.version) {
        throw new Error(`declarative resource identity mismatch: ${entry.id}`);
      }
      if (entry.delivery.hostPluginId === activationContract.ACTIVATION_HOST_PLUGIN_ID) {
        if (seenActivationTargets.has(normalizedPayload.targetPluginId)) {
          throw new Error(`duplicate feature activation target: ${normalizedPayload.targetPluginId}`);
        }
        seenActivationTargets.add(normalizedPayload.targetPluginId);
      }
    } else if (entry.delivery.resourceSha256 !== undefined) {
      throw new Error(`remote-web delivery must not declare resourceSha256: ${entry.id}`);
    }
    manifests.push(manifest);
    return {
      ...entry,
      manifestUrl: expectedManifestUrl,
      delivery: { ...entry.delivery, resourceUrl }
    };
  });

  const inventoryResult = pluginContract.validateInventory(manifests);
  if (!inventoryResult.success) {
    const first = inventoryResult.failures[0];
    throw new Error(`${first.ruleId} ${first.pluginId || first.path || 'inventory'}: ${first.message}`);
  }

  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    contractVersion: pluginContract.PLUGIN_CONTRACT_VERSION,
    registryVersion: catalog.registryVersion,
    plugins
  };
}

module.exports = {
  CATALOG_SCHEMA_VERSION,
  PUBLIC_MANIFEST_BASE,
  declarativeResourceDefinition,
  validateCatalog,
  validateHttpsUrl
};
