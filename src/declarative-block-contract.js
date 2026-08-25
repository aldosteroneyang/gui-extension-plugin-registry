(function initGUIDeclarativeBlockContract(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GUIDeclarativeBlockContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createDeclarativeBlockContract() {
  'use strict';

  const DECLARATIVE_BLOCK_SCHEMA_VERSION = 1;
  const MAX_BLOCKS = 20;
  const PAYLOAD_KEYS = new Set(['schemaVersion', 'pluginId', 'version', 'blocks']);
  const BLOCK_KEYS = new Set(['id', 'type', 'title', 'body', 'tone']);
  const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
  const TONES = new Set(['info', 'success', 'warning']);

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function assertClosed(value, allowedKeys, label) {
    if (!isPlainObject(value)) throw new Error(`${label} must be a plain object`);
    const unknown = Object.keys(value).filter(key => !allowedKeys.has(key));
    if (unknown.length > 0) {
      throw new Error(`${label} contains unknown field(s): ${unknown.sort().join(', ')}`);
    }
  }

  function assertBoundedText(value, label, maxLength) {
    if (typeof value !== 'string' || value.trim() !== value || value.length < 1 || value.length > maxLength) {
      throw new Error(`${label} must be non-empty trimmed text up to ${maxLength} characters`);
    }
    return value;
  }

  function validatePayload(payload) {
    try {
      assertClosed(payload, PAYLOAD_KEYS, 'declarative payload');
      if (payload.schemaVersion !== DECLARATIVE_BLOCK_SCHEMA_VERSION) {
        throw new Error(`unsupported declarative schemaVersion: ${payload.schemaVersion}`);
      }
      if (typeof payload.pluginId !== 'string'
        || payload.pluginId.length > 80
        || !ID_PATTERN.test(payload.pluginId)) {
        throw new Error('declarative payload has invalid pluginId');
      }
      if (typeof payload.version !== 'string' || !SEMVER_PATTERN.test(payload.version)) {
        throw new Error('declarative payload version must use MAJOR.MINOR.PATCH');
      }
      if (!Array.isArray(payload.blocks) || payload.blocks.length < 1 || payload.blocks.length > MAX_BLOCKS) {
        throw new Error(`declarative payload blocks must contain 1-${MAX_BLOCKS} items`);
      }
      const seenIds = new Set();
      const blocks = payload.blocks.map((block, index) => {
        assertClosed(block, BLOCK_KEYS, `declarative block ${index}`);
        if (typeof block.id !== 'string' || block.id.length > 80 || !ID_PATTERN.test(block.id)) {
          throw new Error(`declarative block ${index} has invalid id`);
        }
        if (seenIds.has(block.id)) throw new Error(`duplicate declarative block id: ${block.id}`);
        seenIds.add(block.id);
        if (block.type !== 'notice') throw new Error(`unsupported declarative block type: ${block.type}`);
        if (!TONES.has(block.tone)) throw new Error(`unsupported declarative block tone: ${block.tone}`);
        return {
          id: block.id,
          type: 'notice',
          title: assertBoundedText(block.title, `declarative block ${block.id} title`, 120),
          body: assertBoundedText(block.body, `declarative block ${block.id} body`, 1000),
          tone: block.tone
        };
      });
      return {
        success: true,
        value: {
          schemaVersion: DECLARATIVE_BLOCK_SCHEMA_VERSION,
          pluginId: payload.pluginId,
          version: payload.version,
          blocks
        },
        error: null
      };
    } catch (error) {
      return { success: false, value: null, error };
    }
  }

  function assertPayload(payload) {
    const result = validatePayload(payload);
    if (!result.success) throw result.error;
    return result.value;
  }

  return {
    DECLARATIVE_BLOCK_SCHEMA_VERSION,
    MAX_BLOCKS,
    validatePayload,
    assertPayload
  };
});
