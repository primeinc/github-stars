# 02N — Data Recovery: repos.yml restored from 197 → 2,612

> Direct-evidence ledger of how the manifest was destroyed, recovered, and
> protected against re-destruction. Filed under Epic 02 because the
> destruction was caused by the silent-partial-success bug Epic 02 fixed,
> and the recovery + guard close the remaining gap.

## Damage assessment (direct evidence)

### Live truth

| Source | Count | Date | Basis |
|---|---|---|---|
| `GET /user/starred?per_page=1` Link header `rel="last"` | **2,623 (incl. private)** | 2026-05-10 05:51 UTC | curl with auth, recorded headers |
| Same endpoint paginated, public-only filter | **2,612** | same | 27 pages, ~75s total, recorded in scripts/recover-stars-from-rest.mjs run output |

### State of in-repo manifests when recovery began (`origin/main` = `3ce65b7a`)

| File | Repos | Manifest `manifest_updated_at` | Notes |
|---|---|---|---|
| `repos.yml` | **197** | 2026-05-03T04:26:37Z | live truncated state |
| `web/public/data.json` | 2,085 | 2026-01-29T04:49:02Z | committed in PR #16 (`2e4deb37`); only 4 commits ever to this file |
| `docs/data.json` | 1,959 | 2026-01-11 era | last cron-deploy snapshot before Vite refactor in PR #16 |
| `https://primeinc.github.io/github-stars/data.json` | 197 | 2026-05-03 | rebuilt from current repos.yml at last 04-build run |

### Historical peak in `.github-stars/data/fetched-stars-graphql.json`

| SHA | Date | Count |
|---|---|---|
| `cbd1f6a9` | 2026-03-22 | 2,454 |
| `47f9bc01` | 2026-03-17 | 2,412 |
| `559eaf4e`/`bc436fe8`/`46287a2c` | 2026-03-13–15 | 2,405 |
| `b9460c7f` | 2026-03-09 | 2,392 |

Pattern: every "good" day (2,000+) is followed by partial-success days (97-300) that overwrote the file. The committed `fetched-stars-graphql.json` itself was repeatedly destroyed by the same silent-partial-success bug Epic 02 fixed in `ee50e48c`.

### How the manifest was destroyed

`02-sync-stars.yml` L189 (pre-guard):
```js
const removedRepos = manifestData.repositories.filter(
  r => r?.repo && !currentStarRepos.has(r.repo)
);
```
followed by L194:
```js
manifestData.repositories = manifestData.repositories.filter(
  r => r?.repo && currentStarRepos.has(r.repo)
);
```

Every time `01-fetch` "succeeded" with a partial page set (97 repos when the account had 2,400+), `02-sync` computed `removedRepos = 2,300+` and deleted them. No threshold check existed. The first such successful destruction is consistent with the failure pattern starting around the data growth point in late March 2026; by the time Epic 02 began the manifest was already at 197.

## Recovery

### Tools

- `scripts/recover-stars-from-rest.mjs` — one-shot REST `/user/starred` paginated fetcher. Matches the GraphQL output schema in `01-fetch-stars.yml` L80-106 field-for-field, with documented gaps (`latest_release: null` because REST `/user/starred` does not include releases; `last_commit_sha` set to sentinel because REST does not include the commit SHA; `is_mirror` derived from `mirror_url` presence).
- `scripts/reconstruct-repos-yml.mjs` — merges fresh REST fetch with `web/public/data.json` snapshot to inherit existing classifications.

### Run results

```
Fetching all starred repos via REST...
  page 1/27: 100 items, 97 public, total=97, 3386ms, rate-remaining=4926
  ... 26 more pages ...
  page 27/27: 23 items, 23 public, total=2612, 1007ms, rate-remaining=4900

Total: 2612 public starred repos across 27 pages
Wrote .github-stars/data/fetched-stars-graphql.json (2531092 bytes)
```

```
Reconstruction complete:
  197 repos kept classification from current repos.yml (197 prior)
  2036 repos inherited classification from web/public/data.json snapshot
  379 repos new (will need classification)
  2612 total — written to repos.yml-recovered.yml

Removed (in current but not in fresh): 0
```

### Validation

After `pnpm normalize` (legacy taxonomy values like `cli-tools`, `devops`, `infrastructure`, `media` etc. were stripped from inherited classifications because the canonical taxonomy in `src/manifest/taxonomy.ts` has shrunk since Jan 29):

```
NORMALIZE: Total repos: 2612, Modified repos: 337, Needs review: 389
✅ Validation passed (taxonomy)
```

After `node schema-check.mjs` (cardinalby's `@exodus/schemasafe` `mode: default`):

```
schemasafe mode=default ok= true
```

Both gates green.

## Defense in depth — destructive-deletion guard

`02-sync-stars.yml` (this PR):

```js
const removalRatio = manifestSize > 0 ? removedRepos.length / manifestSize : 0;
const REMOVAL_THRESHOLD = 0.05;
if (removalRatio > REMOVAL_THRESHOLD) {
  core.setFailed(`DESTRUCTIVE SYNC REFUSED: ...`);
  return;
}
```

5% threshold. Any sync that would remove > 5% of the current manifest fails hard with a structured error pointing back to the upstream fetch. This is **defense in depth** — `01-fetch`'s post-`ee50e48c` `partial_failure_reason` gate already prevents 02-sync from running on a partial fetch (because `workflow_run` only fires on `conclusion == 'success'`). The guard catches:

- Manual `workflow_dispatch` of 02-sync against a stale committed `fetched-stars-graphql.json`.
- Future regressions to the 01-fetch hard-fail behavior.
- Edge cases where a fetch completed but returned drastically fewer repos for non-pagination reasons (e.g. token scope change losing visibility into private starring of public repos).

### Bypass

No silent bypass. To force a >5% removal sync (e.g. legitimate mass unstar), the operator must edit the workflow to override `REMOVAL_THRESHOLD` for one run, or compute a one-shot manifest manually.

## Why the underlying GraphQL still doesn't paginate completely

Per first-party doc `docs/content/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api.md` L286-294:

> "If GitHub takes more than 10 seconds to process an API request, GitHub will terminate the request and you will receive a timeout response."

And L300-304 names "Using large `first` or `last` arguments in multiple connections simultaneously" + "Fetching extensive details for each object" as resource-limit examples.

Direct evidence from successful run 25619285899 log:
- Page 1: 9.4s (right at the timeout)
- Page 2: 9.5s (right at the timeout)
- Page 3 onward: every attempt 502/504, retries exhausted

The query in `queries/stars-query.graphql` requests `starredRepositories(first: 100)` × `repositoryTopics(first: 20)` × ~15 fields per repo (including `latestRelease`, `licenseInfo`, `defaultBranchRef.target.oid`). For an account with 2,612 stars across 26 pages of 100, page 3+ deterministically exceeds the 10s budget under load.

This recovery does NOT change the GraphQL query (per operator constraint: "DO NOT FUCKING SHRINK MY APP"). The recovery uses REST as a one-shot bypass; ongoing scheduled runs continue to use GraphQL. Future hardening (smaller pages, drop heavy fields, cursor-resume per #61, or REST fallback) is tracked separately.

## Acceptance for this PR

- [x] `repos.yml` reconstructed with 2,612 entries (matches live `/user/starred` count)
- [x] All 2,612 entries pass `pnpm validate` (taxonomy)
- [x] All 2,612 entries pass `cardinalby/schema-validator-action@v3 mode: default`
- [x] 02-sync hardened with 5% destructive-deletion guard
- [ ] CI green on PR
- [ ] Squash-merged to main
- [ ] 04-build deploys ~2,612 repos to `https://primeinc.github.io/github-stars/`
- [ ] 03-classify processes the 389 needs-review entries (queued; will run in batches via self-dispatch)
