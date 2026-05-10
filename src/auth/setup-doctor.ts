// setup-doctor — prints the resolved auth matrix and writes typed outputs.
//
// Run via `pnpm auth:doctor` or directly in a workflow step. Reads env:
//   AUTH_MODE_REQUEST  (workflow input; default 'auto')
//   STAR_SOURCE_USER   (vars.STAR_SOURCE_USER or default)
//   GH_APP_CLIENT_ID   (vars; presence only)
//   GH_APP_PRIVATE_KEY (secrets; presence only)
//   STARS_TOKEN        (secrets; presence only)
//   GITHUB_TOKEN       (built-in; presence only)
//
// Writes to:
//   stdout       — JSON resolution (one line)
//   $GITHUB_STEP_SUMMARY — markdown matrix (presence/status, never values)
//   $GITHUB_OUTPUT       — auth_mode, star_source_user, star_fetch_auth,
//                          repo_write_auth, degraded, missing_config (joined)
//
// Exits non-zero only when auth_mode === 'disabled' AND the doctor was
// invoked with --strict. Without --strict, a disabled mode is reported
// but the workflow keeps running so 02-Sync can still produce
// downstream-readable diagnostics.

import { appendFileSync, existsSync } from 'node:fs';
import process from 'node:process';
import { resolveAuthMode } from './resolve-auth-mode.js';
import type { AuthMode, ResolvedAuth } from './auth-mode.js';

const VALID_MODES: ReadonlyArray<AuthMode | 'auto'> = [
  'auto', 'github_app', 'pat', 'public', 'github_token', 'disabled',
];

function readEnv(): Parameters<typeof resolveAuthMode>[0] {
  const requested = (process.env.AUTH_MODE_REQUEST || 'auto').trim() as AuthMode | 'auto';
  if (!VALID_MODES.includes(requested)) {
    throw new Error(`AUTH_MODE_REQUEST=${requested} is not one of: ${VALID_MODES.join(', ')}`);
  }
  return {
    requested_mode: requested,
    star_source_user: process.env.STAR_SOURCE_USER || '',
    has_gh_app_client_id: nonEmpty(process.env.GH_APP_CLIENT_ID),
    has_gh_app_private_key: nonEmpty(process.env.GH_APP_PRIVATE_KEY),
    has_stars_token: nonEmpty(process.env.STARS_TOKEN),
    has_github_token: nonEmpty(process.env.GITHUB_TOKEN),
  };
}

function nonEmpty(v: string | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

export function renderSummary(r: ResolvedAuth): string {
  const lines: string[] = [];
  lines.push('## Auth setup-doctor');
  lines.push('');
  lines.push(`- **Auth mode**: \`${r.auth_mode}\`${r.degraded ? ' _(degraded)_' : ''}`);
  lines.push(`- **Star source user**: \`${r.star_source_user || '(unset)'}\``);
  lines.push(`- **Star fetch auth**: \`${r.star_fetch_auth.source}\``);
  lines.push(`- **Repo write auth**: \`${r.repo_write_auth.source}\``);
  lines.push(`- **Reason**: ${r.reason}`);
  if (r.missing_config.length) {
    lines.push(`- **Missing**: ${r.missing_config.map(m => `\`${m}\``).join(', ')}`);
  }
  lines.push('');
  lines.push('### Capability matrix');
  lines.push('');
  lines.push('| Capability | Status |');
  lines.push('|---|---|');
  lines.push(`| Mint GitHub App installation token | \`${r.capabilities.can_mint_app_token}\` |`);
  lines.push(`| Fetch a star page              | \`${r.capabilities.can_fetch_star_page}\` |`);
  lines.push(`| Checkout / commit to target repo | \`${r.capabilities.can_checkout_target_repo}\` |`);
  lines.push('');
  return lines.join('\n');
}

export function writeJobOutputs(r: ResolvedAuth): void {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  const lines = [
    `auth_mode=${r.auth_mode}`,
    `star_source_user=${r.star_source_user}`,
    `star_fetch_auth=${r.star_fetch_auth.source}`,
    `repo_write_auth=${r.repo_write_auth.source}`,
    `degraded=${r.degraded}`,
    `missing_config=${r.missing_config.join(',')}`,
    `reason=${oneLine(r.reason)}`,
  ];
  appendFileSync(out, lines.join('\n') + '\n');
}

function writeSummary(md: string): void {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  if (!existsSync(summary)) return;
  appendFileSync(summary, md + '\n');
}

function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

function main(): void {
  const strict = process.argv.includes('--strict');
  const inputs = readEnv();
  const r = resolveAuthMode(inputs);

  // Always emit JSON to stdout for programmatic consumers.
  process.stdout.write(JSON.stringify(r, null, 2) + '\n');

  // Markdown summary for humans reading the run page.
  writeSummary(renderSummary(r));

  // Structured outputs for downstream workflow steps.
  writeJobOutputs(r);

  if (r.auth_mode === 'disabled' && strict) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('setup-doctor.ts')) {
  main();
}
