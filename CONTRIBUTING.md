# Contract and catalog change policy

## Add or update an online plugin

This does not change the contract version when the manifest remains within the
existing schema and keeps its stable identity.

Required:

- the plugin implementation is private or intentionally public;
- its local tests pass;
- its manifest passes the immutable reusable workflow;
- the production resource uses HTTPS and contains no credential;
- the catalog manifest digest matches the reviewed local manifest;
- the declared packaged host already exists in the minimum Extension version;
- the catalog governance workflow passes.

An update at the same resource URL does not require an Extension release when
the existing packaged host and contract already understand it.

Feature activation is a separate declarative payload type. It must use
`feature-activation-host`, canonical `activation.json`, a target already
allowlisted by the minimum Extension version, and a strict boolean `enabled`.
Removing checks or inventing a target in this repository is not an onboarding
path; Extension support must ship first.

For a multi-context packaged engine, the Extension release must prove every
affected Background, Content, and Options mount boundary before publication.
Disabling an activation controller must not delete saved feature data unless a
separate, explicit migration has been reviewed.

## Add a contract field or capability

This is not an unreviewed JSON addition. Unknown fields remain rejected.

Required order:

1. Document the concrete host requirement.
2. Add a backward-compatible Extension reader and executable tests first.
3. Define behavior when the field is absent.
4. Update this validator and synthetic negative fixtures.
5. Prove existing catalog entries still pass.
6. Increment the appropriate contract version.
7. Publish and pin an immutable contract revision.

Breaking or reinterpreting an existing field requires a major contract release
and an explicit Extension-first migration and rollback plan.

## Public-information boundary

Allowed:

- generic contract fields and synthetic fixtures;
- stable plugin IDs and packaged host IDs;
- public HTTPS manifest and resource URLs.

Forbidden:

- internal hosts, selectors, private network topology, or copied logs;
- real clinical content or identifying records;
- private implementation source;
- secrets, access tokens, private keys, or provider credentials.

`npm run validate:public` is mandatory, but human review is still required.
