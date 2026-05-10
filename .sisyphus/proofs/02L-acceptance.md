# 02L — Final Bulletproof Acceptance Run (closes #54)

> **Status: SCAFFOLD — populated after the production chain runs on `main`.**
>
> See T14 in the PR description (`claude/epic-02-complete` → `main`).
> This file is filled in once the chain `01 → 02 → 03 → 04 → 05` has run
> on `main` post-merge.

## Required evidence (per #54)

| Stage | Workflow | Evidence to capture |
|---|---|---|
| Inventory | n/a | `.sisyphus/proofs/02A-source-inventory.md` ✓ |
| Failure capture | n/a | `.sisyphus/proofs/02B-failed-runs.md` ✓ |
| Topology | n/a | `.sisyphus/proofs/02C-topology.md` ✓ |
| Auth | `01-fetch-stars.yml` | run URL, viewer-login probe success, fetched-stars artifact ID |
| Handoff | `02-sync-stars.yml` | run URL, `mode=artifact`, `source=artifact`, input bytes, manifest delta |
| Schema gate | `02-sync-stars.yml` + `03-classify-repos.yml` | both `cardinalby/schema-validator-action@v3` `mode: default` checks pass; commit SHAs |
| Web build | `04-build-site.yml` | run URL, `npm run lint` + `npm run build` exit 0, `docs/` artifact ID |
| Generated outputs | `05-generate-readmes.yml` | run URL, `categories/`/`tags/`/`README.md` regenerated, commit SHA |
| Web CI gate | `00b-web-ci.yml` | run URL on the merge PR (#TBD), exit 0 |

## Run log (TO FILL)

| Stage | Run URL | Conclusion | Commit SHA | Summary excerpt |
|---|---|---|---|---|
| Web CI on merge PR | TBD | TBD | TBD | TBD |
| 00 CI on merge PR | TBD | TBD | TBD | TBD |
| 01 fetch-stars | TBD | TBD | TBD | TBD |
| 02 sync-stars | TBD | TBD | TBD | TBD |
| 03 classify-repos | TBD | TBD | TBD | TBD |
| 04 build-site | TBD | TBD | TBD | TBD |
| 05 generate-readmes | TBD | TBD | TBD | TBD |

## Acceptance criteria mapping (#54)

| Criterion | Status |
|---|---|
| Final run URL posted | TBD |
| Final commit SHA posted | TBD |
| Fetch, sync, schema validation, web build, generated output proven | TBD |
| Remaining failure modes have follow-up issues | TBD |
| Parent epic #42 updated with completion evidence | TBD |
