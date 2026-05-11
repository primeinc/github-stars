<!--
Read-the-room evidence is mandatory for every implementation PR per
AGENTS.md §0 and issue #75. Fill out every section. Strike through
or mark N/A only when genuinely not applicable, not as a shortcut.
-->

## Summary

<!-- 1-3 sentences. What changed and why. Cite the issue: closes #N -->

## Read-the-room evidence

### Local refs read

- [ ] `AGENTS.md`
- [ ] Issue body and comments (not just title)
- [ ] Affected workflow / source / test files
- [ ] Relevant docs under `docs/` or `.github-stars/docs/`
- [ ] Relevant `.sisyphus/proofs/*` plans if present

### Upstream canonical refs read

- [ ] `../refs/*` first-party source / docs
- [ ] First-party documentation (link)
- [ ] First-party tests / fixtures / examples
- [ ] First-party rationale (changelog, design note, RFC)

### Mapping table

| Local change | Local refs read | Upstream canonical source | Upstream test/fixture | Local adaptation | Proof / gate |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

### Evidence labels

- **Direct evidence:** <!-- exact files, links, run URLs, command outputs -->
- **Weak inference:** <!-- plausible mapping you couldn't fully prove -->
- **Unsupported:** <!-- any remaining gaps; do not leave silent -->
- **Blocked:** <!-- required source/file/tool unavailable -->
- **Contradicted:** <!-- evidence conflicting with the change -->

## Test plan

- [ ] `bun run gate` passes locally (10/10 stages)
- [ ] New tests added for new behavior
- [ ] Manual verification (describe)
- [ ] CI required-checks pass on this PR

## Path-based gates that must pass

<!-- Mark which categories this PR touches; each carries an extra
     evidence requirement per AGENTS.md and the listed issues. -->

- [ ] `.github/workflows/**` — actionlint clean + workflow-lint job (issue #62)
- [ ] `src/auth/**` — auth resolver tests + setup-doctor diagnostics (issue #69)
- [ ] `src/manifest/**` — schema + taxonomy gates (existing) + Zod registry (PR #79)
- [ ] `src/telemetry/**` — quarantined imports per eslint config (PR #79)
- [ ] `src/host-io/**` — sole node:fs/path/os consumer (PR #79)
- [ ] `src/cli/**` or `src/cli-*.ts` — dual-write contract (PR #79)
- [ ] `web/**` — Web CI + tsc --noEmit + bun build
- [ ] `docs/security.md` — SDL controls (issues #27, #29, #30, #31)
- [ ] Privacy-affecting (when #74 lands) — sentinel leak tests
- [ ] AI classifier (when #71 lands) — typed parser + grounding tests
- [ ] AGENTS.md or repo doctrine — linked issue + canonical mapping

## Doctrines that must hold

- [ ] No deferrals — every commit lands green; no "Phase X handles it"
- [ ] No handrolling SDKs — first-party typed SDKs only (octokit etc.)
- [ ] Canonical refs first — `../refs` over blogs / LLM memory
- [ ] TSDoc on every new public export in `src/**`
- [ ] Zod metadata via `.register(reg, meta)` for new schemas
- [ ] Telemetry is observability ONLY (never auth signal)

🤖 Generated with [Claude Code](https://claude.com/claude-code) when applicable
