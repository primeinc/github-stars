# 02C — Workflow Topology Reconciliation (closes #45)

> Direct evidence that the documented workflow topology in `AGENTS.md`
> matches the actual files in `.github/workflows/`. The phantom workflow
> name `03-curate-stars` from the original epic body is dead.

## Actual topology (Direct evidence)

`ls -la .github/workflows/` on the squash branch:

| File | Name (`name:` field) | Trigger | Purpose |
|---|---|---|---|
| `00-ci.yml` | `CI` | `pull_request` to `main`, `push` to `main` | vitest, taxonomy repro, `pnpm validate` |
| `00b-web-ci.yml` | `Web CI` | `pull_request` / `push` to `main` (paths-filtered to `web/**`, `repos.yml`) | `npm ci`, lint, build, output verification |
| `01-fetch-stars.yml` | `01-Fetch GitHub Stars` | cron `0 3 * * *` + `workflow_dispatch` | Pull stars via GraphQL, write `.github-stars/data/fetched-stars-graphql.json`, upload artifact, commit |
| `02-sync-stars.yml` | `02-Sync Starred Repos` | `workflow_run` of `01-Fetch GitHub Stars` + `workflow_dispatch` | Reconcile `repos.yml`, schema-validate twice (`mode: default`), commit |
| `03-classify-repos.yml` | `03-Classify Repos` | `workflow_run` of `02-Sync Starred Repos` + `workflow_dispatch` | AI-classify, normalize, schema-validate (`mode: default`), taxonomy-validate (strict), commit, self-dispatch if more remain |
| `04-build-site.yml` | `04-Build and Deploy Site` | `workflow_run` of `03-Classify Repos` + `workflow_dispatch` + `push` (paths `repos.yml`/`web/**`) | Build site, deploy GitHub Pages, Playwright smoke |
| `05-generate-readmes.yml` | `05-Generate READMEs` | `workflow_run` of `03-Classify Repos` + `workflow_dispatch` + `push` (path `repos.yml`) | Regenerate `categories/*.md`, `tags/*.md`, `README.md` |

## Phantom workflow `03-curate-stars`

| Question | Answer |
|---|---|
| Does `.github/workflows/03-curate-stars.yml` exist? | **No.** `ls .github/workflows/` does not list it. |
| Was it renamed? | Yes — to `03-classify-repos.yml`. The current file performs the same role (post-sync repo classification). |
| Was the old name referenced in docs? | Yes — original `AGENTS.md` §2 (commit before `f26ced98`) and the original epic body (#42). |
| Where is the rename now reflected? | `AGENTS.md` §2 now lists `03-classify-repos.yml` directly. Original epic body line "documents numbered workflows: `01-fetch-stars`, `02-sync-stars`, and `03-curate-stars`" is **stale historical context** in #42 — preserved as the reason 02C was opened. |

No phantom name remains in the active doc surface. Verified:

```bash
rg -n "03-curate-stars" AGENTS.md README.md TAXONOMY_REFACTORING.md \
  .github/workflows/ .sisyphus/ src/ web/ scripts/
# (no hits)
```

## Doc/source diff that closed the gap

The doc reconciliation happened in two commits on the Epic 02 branch:

| Commit | Files | Change |
|---|---|---|
| `f26ced98` | `AGENTS.md` §2 §5 §6 §8 | Replaced `01-fetch-stars`/`02-sync-stars`/`03-curate-stars` listing with the actual six numbered workflows. Added §6 (Generated Data Flow) and §8 (Token Model). |
| `62c2ae16` | `AGENTS.md` §1 §2 | Added the "two layers of validation" framing and the strict-vs-lax + schema-vs-taxonomy distinction (further refined on this branch — see `02I-docs-repair.md`). |

## `workflow_run` chaining (Direct evidence)

```
workflow_dispatch / cron
        │
        ▼
01-Fetch GitHub Stars ─────────► uploads artifact `fetched-stars-${run_id}`
        │ (workflow_run, head_branch=='main', conclusion=='success')
        ▼
02-Sync Starred Repos ─────────► commits repos.yml
        │ (workflow_run, head_branch=='main', conclusion=='success')
        ▼
03-Classify Repos (self-dispatches batches) ─► commits repos.yml
        │ (workflow_run, conclusion=='success')
        ├──► 04-Build and Deploy Site ──► docs/, GitHub Pages
        └──► 05-Generate READMEs ──► categories/, tags/, README.md
```

Verified by `rg -n "workflow_run|workflow_dispatch|head_branch" .github/workflows/`.

## Acceptance criteria mapping (#45)

| Criterion | Evidence |
|---|---|
| Actual workflow topology documented | Table above + `AGENTS.md` §2 §6 |
| `AGENTS.md` and related plans match actual workflow names | `rg "03-curate-stars"` on docs returns 0 hits (sole reference is in the epic body itself, which is by definition historical) |
| Removed/renamed third workflow explicitly explained | `03-curate-stars` → `03-classify-repos` row above |
| No phantom workflow names in active docs | `rg` clean across `AGENTS.md`, `README.md`, `TAXONOMY_REFACTORING.md`, `.sisyphus/`, `src/`, `web/`, `scripts/` |

## Read ledger

- `.github/workflows/00-ci.yml`, `00b-web-ci.yml`, `01-fetch-stars.yml`, `02-sync-stars.yml`, `03-classify-repos.yml`, `04-build-site.yml`, `05-generate-readmes.yml` — full read this branch.
- `AGENTS.md` — full read this branch.
- `.sisyphus/plans/{mvp-phase-2,site-sorting-fix,terminology-refactor}.md` — full read; all flagged `Status: ARCHIVED` (verified in `02I-docs-repair.md`).
