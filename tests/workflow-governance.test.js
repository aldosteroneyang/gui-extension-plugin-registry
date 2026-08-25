'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workflow = fs.readFileSync(
  path.resolve(__dirname, '..', '.github', 'workflows', 'plugin-contract.yml'),
  'utf8'
);

test('reusable workflow requires one immutable workflow and validator revision', () => {
  assert.match(workflow, /WORKFLOW_REF: \$\{\{ job\.workflow_ref \}\}/);
  assert.match(workflow, /WORKFLOW_SHA: \$\{\{ job\.workflow_sha \}\}/);
  assert.match(
    workflow,
    /gui-extension-plugin-registry\/\.github\/workflows\/plugin-contract\.yml@\$CONTRACT_REF/
  );
  assert.match(workflow, /"\$WORKFLOW_SHA" != "\$CONTRACT_REF"/);
  assert.doesNotMatch(workflow, /github\.workflow_ref/);
});
