# Bot, App, and Subsystem Naming Doctrine

This doc names every actor and subsystem in the `github-stars`
control plane so audit logs, workflow summaries, and operator-facing
output are unambiguous.

Source issue: #73. Related: #69, #42, #54, #71, #75.

## Naming rules

```text
GitHub App identity:
  primeinc-github-stars

Subsystem/check prefix:
  primeinc-stars-*

Pattern:
  <scope>-<surface>-<role>

Rules:
  lowercase kebab-case
  clear audit-log meaning
  provider-neutral unless truly provider-specific
  no cute name at the cost of traceability
  GitHub App names stay <= 34 chars (per GitHub App constraints)
```

## Identities and subsystems

| Name | Type | Role |
|---|---|---|
| `primeinc-github-stars` | GitHub App identity | Installed, repo-scoped app identity (`primeinc/github-stars` only). Used for attribution and installation-token auth. App ID 3663316, Client ID `Iv23liRZxVz4rlcQnAKt`. |
| `primeinc-stars-yoshi-doctor` | setup doctor subsystem | Auth + config + permission diagnostics. The Super Mario World helper reference is intentional and scoped to the diagnostic surface — it does NOT bleed into the app identity, which stays boring for audit-log clarity. Implementation: `src/auth/setup-doctor.ts`. |
| `primeinc-stars-auth` | subsystem | Auth-mode resolver and token-source reporting. Implementation: `src/auth/resolve-auth-mode.ts` + `src/auth/auth-mode.ts`. |
| `primeinc-stars-classifier` | subsystem | AI classification parsing, validation, evidence checks. Currently scaffolded in `.github/workflows/03-classify-repos.yml`; TypeScript port in flight (#71). |
| `primeinc-stars-router` | subsystem | Failure → issue / PR / agent-task routing. Not yet implemented. |
| `primeinc-stars-provenance` | subsystem | Generated artifact registry, proof, summaries, attestations. Implementation: `src/generated/registry.ts` (current) + future attestations work. |
| `primeinc-stars-guard` | subsystem | Security / dependency watch surface. Currently delegated to GitHub-native (CodeQL + Dependabot + `bun audit` gate from #30). |

### Why split the diagnostic name from the app identity

```text
installed app identity must be boring and auditable
setup doctor can carry the Super Mario World helper reference
Yoshi = helper/companion that carries the run through hostile terrain
```

`primeinc-github-stars` shows up in commit attributions and webhook
payloads — those need to be greppable and unambiguous. The
`yoshi-doctor` reference is reserved for the diagnostic check name
operators see in workflow summaries, where memorability has a
purpose.

## Future-naming guardrails

When adding a new subsystem:

1. Pick the name first — don't let the implementation file name
   become the canonical name by accident.
2. Add a row to the table above with a one-sentence role.
3. If the subsystem manifests as a GitHub App identity (rather than a
   subsystem within `primeinc-github-stars`), file an issue first —
   adding new app identities expands the audit surface.

## Cross-refs

- Permission capability ledger: `.github-stars/control-plane/permissions.yml`
- Setup-doctor source: `src/auth/setup-doctor.ts`
- Auth resolver source: `src/auth/resolve-auth-mode.ts`
- Generated artifact registry: `src/generated/registry.ts`
