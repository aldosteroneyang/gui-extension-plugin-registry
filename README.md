# GUI Extension Plugin Registry

Public, sanitized plugin contract, catalog, and release gates for the WEBNM GUI
Report Extension.

This repository separates the Extension core release cycle from online plugin
publication. It contains no private plugin implementation and no clinical data.
Private plugin repositories publish only a strict manifest or a browser-visible
resource through HTTPS.

## Safety boundary

Chrome Manifest V3 does not allow an Extension to download and execute new
JavaScript with Extension privileges. This Registry therefore accepts only:

- `declarative`: validated data interpreted by an already packaged host;
- `remote-web`: an HTTPS web surface or remote registry handled by an already
  packaged host.

New privileged handlers, alarms, storage owners, or lifecycle code still
require a reviewed Extension release. A registered online plugin cannot grant
itself a permission or bypass its packaged host.

## Current catalog

[`registry/plugins.json`](registry/plugins.json) is the only production
allowlist. `report-generators` represents the existing Report Generator
remote-web system and delegates it to the packaged `generator-host`; the
Generator's own manifest and clinical contract remain independently versioned.
`online-options-help` is a declarative proof plugin delegated to the packaged
`declarative-block-host`; its strict text-only notice can change online without
an Extension release.
`worklist-sort-online` is the first activation controller for an existing
business plugin. Its strict `activation.json` can only toggle the Extension-
allowlisted packaged `worklist-sort` lifecycle through
`feature-activation-host`; it cannot add a target, handler, capability,
permission, storage namespace, or downloaded JavaScript.

Each catalog entry pins the exact SHA-256 of its local plugin manifest. The
validator checks closed schemas, supported versions, identity, capability
scope, remote-code boundaries, collision rules, delivery host, HTTPS URLs, and
local/remote manifest parity.

## Local verification

Requires Node.js 22 or newer and has no runtime dependencies.

```sh
npm run verify
```

To validate a manifest in a separate plugin repository:

```sh
node scripts/validate-plugin-contract.js \
  --manifest /absolute/path/to/plugin-manifest.json \
  --expected-id example-plugin \
  --expected-kind declarative
```

## Reusable immutable gate

Plugin repositories call
`.github/workflows/plugin-contract.yml` at a full 40-character commit SHA and
pass the same SHA as `contract-ref`. The workflow rejects mutable branch or tag
pins before checking out and executing this validator.

Catalog changes use pull requests and must pass `Contract Governance`. A
successful workflow is release evidence; a written claim that checks passed is
not.
