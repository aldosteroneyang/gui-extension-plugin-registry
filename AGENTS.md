# Plugin Registry Maintainer Instructions

This public repository is the sanitized contract and allowlist for remote GUI
Extension plugins. It must never contain clinical records, credentials,
private implementation source, internal network details, or copied production
payloads.

## Required gate

Before publishing any change, run `npm run verify`. Catalog or contract changes
must remain closed-schema and must be accepted by executable checks. Prose,
checkboxes, labels, or self-attestation never count as release evidence.

## Compatibility

- Keep plugin IDs and delivery host IDs stable.
- Add compatible Extension readers before changing a durable contract.
- Only `declarative` and `remote-web` manifests may be registered here.
- Remote resources must be handled by a reviewed packaged host already present
  in the Extension. This registry never authorizes downloaded JavaScript to run
  with Extension privileges.
- Contract-breaking changes require an Extension-first migration and a major
  contract version.
