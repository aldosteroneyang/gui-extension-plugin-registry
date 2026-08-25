(function initGUIPluginActivationContract(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GUIPluginActivationContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPluginActivationContract() {
  'use strict';

  const ACTIVATION_SCHEMA_VERSION = 1;
  const ACTIVATION_HOST_PLUGIN_ID = 'feature-activation-host';
  const ACTIVATABLE_PLUGIN_DEFAULTS = Object.freeze({
    'worklist-sort': true
  });
  const PAYLOAD_KEYS = new Set([
    'schemaVersion',
    'pluginId',
    'version',
    'targetPluginId',
    'enabled'
  ]);
  const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.prototype.toString.call(value) === '[object Object]';
  }

  function assertPluginId(value, label) {
    if (typeof value !== 'string' || value.length > 80 || !PLUGIN_ID_PATTERN.test(value)) {
      throw new Error(`${label} must be a stable lowercase kebab-case plugin id`);
    }
    return value;
  }

  function assertPayload(value) {
    if (!isPlainObject(value)) throw new Error('plugin activation payload must be a plain object');
    const unknown = Object.keys(value).filter(key => !PAYLOAD_KEYS.has(key));
    if (unknown.length > 0) {
      throw new Error(`plugin activation payload contains unknown field(s): ${unknown.sort().join(', ')}`);
    }
    if (value.schemaVersion !== ACTIVATION_SCHEMA_VERSION) {
      throw new Error(`unsupported plugin activation schemaVersion: ${value.schemaVersion}`);
    }
    const pluginId = assertPluginId(value.pluginId, 'plugin activation pluginId');
    if (typeof value.version !== 'string' || !SEMVER_PATTERN.test(value.version)) {
      throw new Error('plugin activation version must use MAJOR.MINOR.PATCH');
    }
    const targetPluginId = assertPluginId(
      value.targetPluginId,
      'plugin activation targetPluginId'
    );
    if (!Object.prototype.hasOwnProperty.call(ACTIVATABLE_PLUGIN_DEFAULTS, targetPluginId)) {
      throw new Error(`plugin activation target is not remotely activatable: ${targetPluginId}`);
    }
    if (typeof value.enabled !== 'boolean') {
      throw new Error('plugin activation enabled must be a strict boolean');
    }
    return Object.freeze({
      schemaVersion: ACTIVATION_SCHEMA_VERSION,
      pluginId,
      version: value.version,
      targetPluginId,
      enabled: value.enabled
    });
  }

  return Object.freeze({
    ACTIVATION_SCHEMA_VERSION,
    ACTIVATION_HOST_PLUGIN_ID,
    ACTIVATABLE_PLUGIN_DEFAULTS,
    assertPayload
  });
});
