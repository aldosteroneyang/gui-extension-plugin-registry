(function initGUIPluginContract(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GUIPluginContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createGUIPluginContract() {
  'use strict';

  const PLUGIN_MANIFEST_SCHEMA_VERSION = 1;
  const PLUGIN_CONTRACT_VERSION = 1;
  const PLUGIN_KINDS = Object.freeze(['packaged', 'declarative', 'remote-web']);
  const PLUGIN_CONTEXTS = Object.freeze(['background', 'content', 'options']);
  const PLUGIN_LIFECYCLE_HOOKS = Object.freeze(['initialize', 'dispose']);
  const PLUGIN_STORAGE_AREAS = Object.freeze(['local', 'sync', 'indexeddb', 'cold-folder']);
  const PLUGIN_DATA_CLASSES = Object.freeze([
    'configuration',
    'ui-preference',
    'cache',
    'clinical-local',
    'credential'
  ]);

  const CAPABILITY_DEFINITIONS = Object.freeze({
    'broker.services': { contexts: PLUGIN_CONTEXTS, kinds: PLUGIN_KINDS },
    'runtime.messages': { contexts: PLUGIN_CONTEXTS, kinds: ['packaged'] },
    'runtime.alarms': { contexts: ['background'], kinds: ['packaged'] },
    'runtime.badge': { contexts: ['background'], kinds: ['packaged'] },
    'runtime.tabs': { contexts: ['background'], kinds: ['packaged'] },
    'runtime.scripting': { contexts: ['background'], kinds: ['packaged'] },
    'storage.local': { contexts: PLUGIN_CONTEXTS, kinds: ['packaged'] },
    'storage.sync': { contexts: PLUGIN_CONTEXTS, kinds: ['packaged'] },
    'storage.indexeddb': { contexts: ['background', 'options'], kinds: ['packaged'] },
    'storage.cold-folder': { contexts: ['background', 'options'], kinds: ['packaged'] },
    'network.registry': { contexts: ['background'], kinds: ['packaged'] },
    'network.openai': { contexts: ['background'], kinds: ['packaged'] },
    'webnm.context': { contexts: ['content'], kinds: PLUGIN_KINDS },
    'webnm.areas.read': { contexts: ['content'], kinds: PLUGIN_KINDS },
    'webnm.areas.write': { contexts: ['content'], kinds: PLUGIN_KINDS },
    'webnm.submit': { contexts: ['content'], kinds: ['packaged', 'declarative'] },
    'ui.webnm': { contexts: ['content'], kinds: PLUGIN_KINDS },
    'ui.options': { contexts: ['options'], kinds: ['packaged', 'declarative'] },
    'ui.remote-surface': { contexts: ['content', 'options'], kinds: ['packaged', 'remote-web'] }
  });

  const HARD_RULES = Object.freeze([
    {
      id: 'PLUGIN-BASE-001',
      check: 'closedSchema',
      description: 'Manifest and entrypoint objects use closed schemas.'
    },
    {
      id: 'PLUGIN-BASE-002',
      check: 'supportedVersions',
      description: 'Manifest and contract versions are explicitly supported.'
    },
    {
      id: 'PLUGIN-BASE-003',
      check: 'durableIdentity',
      description: 'Plugin identity, release version, and kind are canonical.'
    },
    {
      id: 'PLUGIN-ENTRY-001',
      check: 'entrypointShape',
      description: 'At least one context entrypoint is complete and canonical.'
    },
    {
      id: 'PLUGIN-CAP-001',
      check: 'capabilityAllowlist',
      description: 'Capabilities are known and valid for the plugin kind and context.'
    },
    {
      id: 'PLUGIN-RUNTIME-001',
      check: 'runtimeDeclarations',
      description: 'Actions, alarms, lifecycle hooks, and services are bounded and unique.'
    },
    {
      id: 'PLUGIN-KIND-001',
      check: 'remoteBoundary',
      description: 'Only packaged plugins may declare privileged executable runtime hooks.'
    },
    {
      id: 'PLUGIN-STORAGE-001',
      check: 'storageDeclarations',
      description: 'Storage namespaces are typed, isolated, and capability-backed.'
    }
  ]);

  const TOP_LEVEL_KEYS = new Set([
    'schemaVersion',
    'contractVersion',
    'id',
    'version',
    'kind',
    'entrypoints',
    'storage'
  ]);
  const ENTRYPOINT_KEYS = new Set([
    'capabilities',
    'messageActions',
    'alarmNames',
    'lifecycle',
    'provides',
    'consumes'
  ]);
  const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
  const ACTION_PATTERN = /^[a-z][A-Za-z0-9]{0,79}$/;
  const ALARM_PATTERN = /^[a-z][A-Za-z0-9._-]{0,127}$/;
  const SERVICE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
  const STORAGE_KEYS = new Set(['namespace', 'area', 'schemaVersion', 'dataClass']);

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.prototype.toString.call(value) === '[object Object]';
  }

  function unknownKeys(value, allowedKeys) {
    if (!isPlainObject(value)) return [];
    return Object.keys(value).filter(key => !allowedKeys.has(key));
  }

  function isUniqueStringArray(value) {
    return Array.isArray(value)
      && value.every(item => typeof item === 'string')
      && new Set(value).size === value.length;
  }

  function addFailure(failures, ruleId, message, path = '') {
    failures.push({ ruleId, message, path });
  }

  const RULE_CHECKS = Object.freeze({
    closedSchema(manifest, failures) {
      if (!isPlainObject(manifest)) {
        addFailure(failures, 'PLUGIN-BASE-001', 'plugin manifest must be a plain object');
        return;
      }

      const extraTopLevelKeys = unknownKeys(manifest, TOP_LEVEL_KEYS);
      if (extraTopLevelKeys.length > 0) {
        addFailure(
          failures,
          'PLUGIN-BASE-001',
          `plugin manifest contains unknown field(s): ${extraTopLevelKeys.join(', ')}`
        );
      }

      if (!isPlainObject(manifest.entrypoints)) return;
      Object.entries(manifest.entrypoints).forEach(([context, entrypoint]) => {
        if (!isPlainObject(entrypoint)) return;
        const extraEntrypointKeys = unknownKeys(entrypoint, ENTRYPOINT_KEYS);
        if (extraEntrypointKeys.length > 0) {
          addFailure(
            failures,
            'PLUGIN-BASE-001',
            `entrypoint contains unknown field(s): ${extraEntrypointKeys.join(', ')}`,
            `entrypoints.${context}`
          );
        }
      });

      if (!Array.isArray(manifest.storage)) return;
      manifest.storage.forEach((storage, index) => {
        if (!isPlainObject(storage)) return;
        const extraStorageKeys = unknownKeys(storage, STORAGE_KEYS);
        if (extraStorageKeys.length > 0) {
          addFailure(
            failures,
            'PLUGIN-BASE-001',
            `storage declaration contains unknown field(s): ${extraStorageKeys.join(', ')}`,
            `storage.${index}`
          );
        }
      });
    },

    supportedVersions(manifest, failures) {
      if (!isPlainObject(manifest)) return;
      if (manifest.schemaVersion !== PLUGIN_MANIFEST_SCHEMA_VERSION) {
        addFailure(
          failures,
          'PLUGIN-BASE-002',
          `unsupported plugin manifest schemaVersion: ${manifest.schemaVersion}`,
          'schemaVersion'
        );
      }
      if (manifest.contractVersion !== PLUGIN_CONTRACT_VERSION) {
        addFailure(
          failures,
          'PLUGIN-BASE-002',
          `unsupported plugin contractVersion: ${manifest.contractVersion}`,
          'contractVersion'
        );
      }
    },

    durableIdentity(manifest, failures) {
      if (!isPlainObject(manifest)) return;
      if (typeof manifest.id !== 'string'
        || manifest.id.length > 80
        || !PLUGIN_ID_PATTERN.test(manifest.id)) {
        addFailure(failures, 'PLUGIN-BASE-003', 'invalid plugin id', 'id');
      }
      if (typeof manifest.version !== 'string' || !SEMVER_PATTERN.test(manifest.version)) {
        addFailure(failures, 'PLUGIN-BASE-003', 'plugin version must use MAJOR.MINOR.PATCH', 'version');
      }
      if (!PLUGIN_KINDS.includes(manifest.kind)) {
        addFailure(failures, 'PLUGIN-BASE-003', `unsupported plugin kind: ${manifest.kind}`, 'kind');
      }
    },

    entrypointShape(manifest, failures) {
      if (!isPlainObject(manifest) || !isPlainObject(manifest.entrypoints)) {
        addFailure(failures, 'PLUGIN-ENTRY-001', 'plugin entrypoints must be a plain object', 'entrypoints');
        return;
      }

      if (!Array.isArray(manifest.storage)) {
        addFailure(failures, 'PLUGIN-ENTRY-001', 'plugin storage must be an array', 'storage');
      }

      const contexts = Object.keys(manifest.entrypoints);
      if (contexts.length === 0) {
        addFailure(failures, 'PLUGIN-ENTRY-001', 'plugin must declare at least one entrypoint', 'entrypoints');
      }

      contexts.forEach(context => {
        if (!PLUGIN_CONTEXTS.includes(context)) {
          addFailure(failures, 'PLUGIN-ENTRY-001', `unsupported plugin context: ${context}`, `entrypoints.${context}`);
          return;
        }

        const entrypoint = manifest.entrypoints[context];
        if (!isPlainObject(entrypoint)) {
          addFailure(failures, 'PLUGIN-ENTRY-001', 'entrypoint must be a plain object', `entrypoints.${context}`);
          return;
        }

        ENTRYPOINT_KEYS.forEach(key => {
          if (!isUniqueStringArray(entrypoint[key])) {
            addFailure(
              failures,
              'PLUGIN-ENTRY-001',
              `${key} must be an array of unique strings`,
              `entrypoints.${context}.${key}`
            );
          }
        });
      });
    },

    capabilityAllowlist(manifest, failures) {
      if (!isPlainObject(manifest) || !isPlainObject(manifest.entrypoints)) return;
      Object.entries(manifest.entrypoints).forEach(([context, entrypoint]) => {
        if (!isPlainObject(entrypoint) || !Array.isArray(entrypoint.capabilities)) return;
        const declaredBrokerValues = [
          ...(Array.isArray(entrypoint.provides) ? entrypoint.provides : []),
          ...(Array.isArray(entrypoint.consumes) ? entrypoint.consumes : [])
        ];
        if (declaredBrokerValues.length > 0 && !entrypoint.capabilities.includes('broker.services')) {
          addFailure(
            failures,
            'PLUGIN-CAP-001',
            'service providers and consumers require broker.services',
            `entrypoints.${context}.capabilities`
          );
        }
        if (Array.isArray(entrypoint.messageActions)
          && entrypoint.messageActions.length > 0
          && !entrypoint.capabilities.includes('runtime.messages')) {
          addFailure(
            failures,
            'PLUGIN-CAP-001',
            'message actions require runtime.messages',
            `entrypoints.${context}.capabilities`
          );
        }
        if (Array.isArray(entrypoint.alarmNames)
          && entrypoint.alarmNames.length > 0
          && !entrypoint.capabilities.includes('runtime.alarms')) {
          addFailure(
            failures,
            'PLUGIN-CAP-001',
            'alarm names require runtime.alarms',
            `entrypoints.${context}.capabilities`
          );
        }
        entrypoint.capabilities.forEach(capability => {
          const definition = CAPABILITY_DEFINITIONS[capability];
          if (!definition) {
            addFailure(
              failures,
              'PLUGIN-CAP-001',
              `unknown capability: ${capability}`,
              `entrypoints.${context}.capabilities`
            );
            return;
          }
          if (!definition.contexts.includes(context)) {
            addFailure(
              failures,
              'PLUGIN-CAP-001',
              `capability ${capability} is not available in ${context}`,
              `entrypoints.${context}.capabilities`
            );
          }
          if (!definition.kinds.includes(manifest.kind)) {
            addFailure(
              failures,
              'PLUGIN-CAP-001',
              `capability ${capability} is not available to ${manifest.kind} plugins`,
              `entrypoints.${context}.capabilities`
            );
          }
        });
      });
    },

    runtimeDeclarations(manifest, failures) {
      if (!isPlainObject(manifest) || !isPlainObject(manifest.entrypoints)) return;
      Object.entries(manifest.entrypoints).forEach(([context, entrypoint]) => {
        if (!isPlainObject(entrypoint)) return;
        const basePath = `entrypoints.${context}`;
        if (Array.isArray(entrypoint.messageActions)) {
          entrypoint.messageActions.forEach(action => {
            if (!ACTION_PATTERN.test(action)) {
              addFailure(failures, 'PLUGIN-RUNTIME-001', `invalid message action: ${action}`, `${basePath}.messageActions`);
            }
          });
        }
        if (Array.isArray(entrypoint.alarmNames)) {
          entrypoint.alarmNames.forEach(alarmName => {
            if (!ALARM_PATTERN.test(alarmName)) {
              addFailure(failures, 'PLUGIN-RUNTIME-001', `invalid alarm name: ${alarmName}`, `${basePath}.alarmNames`);
            }
          });
        }
        if (Array.isArray(entrypoint.lifecycle)) {
          entrypoint.lifecycle.forEach(hook => {
            if (!PLUGIN_LIFECYCLE_HOOKS.includes(hook)) {
              addFailure(failures, 'PLUGIN-RUNTIME-001', `unsupported lifecycle hook: ${hook}`, `${basePath}.lifecycle`);
            }
          });
        }
        ['provides', 'consumes'].forEach(key => {
          if (!Array.isArray(entrypoint[key])) return;
          entrypoint[key].forEach(serviceId => {
            if (serviceId.length > 120 || !SERVICE_PATTERN.test(serviceId)) {
              addFailure(failures, 'PLUGIN-RUNTIME-001', `invalid service id: ${serviceId}`, `${basePath}.${key}`);
            }
          });
        });
        if (Array.isArray(entrypoint.provides) && Array.isArray(entrypoint.consumes)) {
          const overlap = entrypoint.provides.filter(serviceId => entrypoint.consumes.includes(serviceId));
          if (overlap.length > 0) {
            addFailure(
              failures,
              'PLUGIN-RUNTIME-001',
              `plugin must not both provide and consume the same service: ${overlap.join(', ')}`,
              basePath
            );
          }
        }
      });
    },

    remoteBoundary(manifest, failures) {
      if (!isPlainObject(manifest)
        || manifest.kind === 'packaged'
        || !isPlainObject(manifest.entrypoints)) return;

      Object.entries(manifest.entrypoints).forEach(([context, entrypoint]) => {
        if (!isPlainObject(entrypoint)) return;
        const privilegedDeclarations = [
          ...(Array.isArray(entrypoint.messageActions) ? entrypoint.messageActions : []),
          ...(Array.isArray(entrypoint.alarmNames) ? entrypoint.alarmNames : []),
          ...(Array.isArray(entrypoint.lifecycle) ? entrypoint.lifecycle : []),
          ...(Array.isArray(entrypoint.provides) ? entrypoint.provides : [])
        ];
        if (privilegedDeclarations.length > 0) {
          addFailure(
            failures,
            'PLUGIN-KIND-001',
            `${manifest.kind} plugins cannot declare executable runtime hooks`,
            `entrypoints.${context}`
          );
        }
      });

      if (Array.isArray(manifest.storage) && manifest.storage.length > 0) {
        addFailure(
          failures,
          'PLUGIN-KIND-001',
          `${manifest.kind} plugins cannot own extension storage namespaces`,
          'storage'
        );
      }
    },

    storageDeclarations(manifest, failures) {
      if (!isPlainObject(manifest) || !Array.isArray(manifest.storage)) return;
      const seenNamespaces = new Set();
      const capabilities = new Set();
      if (isPlainObject(manifest.entrypoints)) {
        Object.values(manifest.entrypoints).forEach(entrypoint => {
          if (!isPlainObject(entrypoint) || !Array.isArray(entrypoint.capabilities)) return;
          entrypoint.capabilities.forEach(capability => capabilities.add(capability));
        });
      }

      manifest.storage.forEach((storage, index) => {
        const path = `storage.${index}`;
        if (!isPlainObject(storage)) {
          addFailure(failures, 'PLUGIN-STORAGE-001', 'storage declaration must be a plain object', path);
          return;
        }
        if (typeof storage.namespace !== 'string'
          || storage.namespace.length > 120
          || !SERVICE_PATTERN.test(storage.namespace)) {
          addFailure(failures, 'PLUGIN-STORAGE-001', 'invalid storage namespace', `${path}.namespace`);
        } else if (seenNamespaces.has(storage.namespace)) {
          addFailure(failures, 'PLUGIN-STORAGE-001', `duplicate storage namespace: ${storage.namespace}`, `${path}.namespace`);
        } else {
          seenNamespaces.add(storage.namespace);
        }
        if (!PLUGIN_STORAGE_AREAS.includes(storage.area)) {
          addFailure(failures, 'PLUGIN-STORAGE-001', `unsupported storage area: ${storage.area}`, `${path}.area`);
        }
        if (!Number.isInteger(storage.schemaVersion) || storage.schemaVersion < 1) {
          addFailure(failures, 'PLUGIN-STORAGE-001', 'storage schemaVersion must be a positive integer', `${path}.schemaVersion`);
        }
        if (!PLUGIN_DATA_CLASSES.includes(storage.dataClass)) {
          addFailure(failures, 'PLUGIN-STORAGE-001', `unsupported dataClass: ${storage.dataClass}`, `${path}.dataClass`);
        }
        if (storage.area === 'sync'
          && (storage.dataClass === 'clinical-local' || storage.dataClass === 'credential')) {
          addFailure(
            failures,
            'PLUGIN-STORAGE-001',
            `${storage.dataClass} data must not use sync storage`,
            path
          );
        }
        if (storage.dataClass === 'credential' && storage.area !== 'indexeddb') {
          addFailure(failures, 'PLUGIN-STORAGE-001', 'credentials must use isolated IndexedDB storage', path);
        }
        const requiredCapability = `storage.${storage.area}`;
        if (!capabilities.has(requiredCapability)) {
          addFailure(
            failures,
            'PLUGIN-STORAGE-001',
            `storage namespace requires declared capability: ${requiredCapability}`,
            path
          );
        }
      });
    }
  });

  function validateManifest(manifest) {
    const failures = [];
    HARD_RULES.forEach(rule => {
      const check = RULE_CHECKS[rule.check];
      if (typeof check !== 'function') {
        addFailure(failures, rule.id, `hard rule has no executable check: ${rule.check}`);
        return;
      }
      check(manifest, failures);
    });
    return {
      success: failures.length === 0,
      failures
    };
  }

  function assertManifest(manifest) {
    const result = validateManifest(manifest);
    if (!result.success) {
      const first = result.failures[0];
      const error = new Error(`${first.ruleId}: ${first.message}${first.path ? ` (${first.path})` : ''}`);
      error.name = 'PluginContractError';
      error.ruleId = first.ruleId;
      error.failures = result.failures;
      throw error;
    }
    return manifest;
  }

  function validateInventory(input) {
    const manifests = Array.isArray(input)
      ? input
      : (isPlainObject(input) ? Object.values(input) : []);
    const failures = [];
    const pluginIds = new Map();
    const storageNamespaces = new Map();
    const contextClaims = new Map();
    const serviceProviders = new Map();
    const serviceConsumers = [];

    if ((!Array.isArray(input) && !isPlainObject(input)) || manifests.length === 0) {
      addFailure(failures, 'PLUGIN-ENTRY-001', 'plugin inventory must contain at least one manifest');
      return { success: false, failures, manifestCount: manifests.length };
    }

    function claim(context, type, value, pluginId, ruleId) {
      const key = `${context}\u0000${type}\u0000${value}`;
      const owner = contextClaims.get(key);
      if (owner && owner !== pluginId) {
        addFailure(
          failures,
          ruleId,
          `${type} ${value} in ${context} is owned by both ${owner} and ${pluginId}`,
          pluginId
        );
        return;
      }
      contextClaims.set(key, pluginId);
    }

    manifests.forEach((manifest, index) => {
      const result = validateManifest(manifest);
      result.failures.forEach(failure => failures.push({
        ...failure,
        pluginId: isPlainObject(manifest) && typeof manifest.id === 'string'
          ? manifest.id
          : `inventory.${index}`
      }));
      if (!isPlainObject(manifest) || typeof manifest.id !== 'string') return;

      if (pluginIds.has(manifest.id)) {
        addFailure(
          failures,
          'PLUGIN-BASE-003',
          `duplicate plugin id: ${manifest.id}`,
          manifest.id
        );
      } else {
        pluginIds.set(manifest.id, index);
      }

      if (Array.isArray(manifest.storage)) {
        manifest.storage.forEach(declaration => {
          if (!isPlainObject(declaration) || typeof declaration.namespace !== 'string') return;
          const owner = storageNamespaces.get(declaration.namespace);
          if (owner && owner !== manifest.id) {
            addFailure(
              failures,
              'PLUGIN-STORAGE-001',
              `storage namespace ${declaration.namespace} is owned by both ${owner} and ${manifest.id}`,
              manifest.id
            );
          } else {
            storageNamespaces.set(declaration.namespace, manifest.id);
          }
        });
      }

      if (!isPlainObject(manifest.entrypoints)) return;
      Object.entries(manifest.entrypoints).forEach(([context, entrypoint]) => {
        if (!isPlainObject(entrypoint)) return;
        (Array.isArray(entrypoint.messageActions) ? entrypoint.messageActions : [])
          .forEach(action => claim(context, 'message action', action, manifest.id, 'PLUGIN-RUNTIME-001'));
        (Array.isArray(entrypoint.alarmNames) ? entrypoint.alarmNames : [])
          .forEach(alarm => claim(context, 'alarm', alarm, manifest.id, 'PLUGIN-RUNTIME-001'));
        (Array.isArray(entrypoint.provides) ? entrypoint.provides : [])
          .forEach(serviceId => {
            claim(context, 'service', serviceId, manifest.id, 'PLUGIN-RUNTIME-001');
            serviceProviders.set(`${context}\u0000${serviceId}`, manifest.id);
          });
        (Array.isArray(entrypoint.consumes) ? entrypoint.consumes : [])
          .forEach(serviceId => serviceConsumers.push({ context, serviceId, pluginId: manifest.id }));
      });
    });

    serviceConsumers.forEach(({ context, serviceId, pluginId }) => {
      if (!serviceProviders.has(`${context}\u0000${serviceId}`)) {
        addFailure(
          failures,
          'PLUGIN-RUNTIME-001',
          `service ${serviceId} consumed by ${pluginId} has no provider in ${context}`,
          pluginId
        );
      }
    });

    return {
      success: failures.length === 0,
      failures,
      manifestCount: manifests.length
    };
  }

  return {
    PLUGIN_MANIFEST_SCHEMA_VERSION,
    PLUGIN_CONTRACT_VERSION,
    PLUGIN_KINDS,
    PLUGIN_CONTEXTS,
    PLUGIN_LIFECYCLE_HOOKS,
    PLUGIN_STORAGE_AREAS,
    PLUGIN_DATA_CLASSES,
    CAPABILITY_DEFINITIONS,
    HARD_RULES,
    RULE_CHECKS,
    validateManifest,
    assertManifest,
    validateInventory
  };
});
