// setup-doctor — resolves auth mode at config time, emits the strict shape.
//
// Per session-oracle verdict, the doctor outputs:
//   - selected_mode (the credential class chosen at config time)
//   - star_fetch_auth, repo_write_auth (always == selected_mode; no mixing)
//   - pat_fallback_to_github_token (bool; only meaningful for pat mode)
//   - degraded (true iff selected_mode == github_token)
//   - reason
//
// The runtime fallback transition (effective_mode flipping from pat to
// github_token on a runtime credential failure) happens INSIDE the
// fetch/sync CLIs and is reported by THEM, not here. The doctor only
// reports the config-time selection.
//
// Reads env (presence only, never values printed):
//   AUTH_MODE_REQUEST                 (workflow input; default 'auto')
//   STAR_SOURCE_USER                  (vars; default empty)
//   GH_APP_CLIENT_ID                  (vars)
//   GH_APP_PRIVATE_KEY                (secret)
//   STARS_TOKEN                       (secret)
//   GITHUB_TOKEN                      (built-in)
//   PAT_FALLBACK_TO_GITHUB_TOKEN      (workflow input; default 'true')

import { appendFileSync, existsSync } from 'node:fs';
import process from 'node:process';
import { AuthConfigError, resolveAuthMode } from './resolve-auth-mode.js';
import { AUTH_MODES, type AuthMode, type ResolvedAuth } from './auth-mode.js';

const VALID_REQUEST_MODES: ReadonlyArray<AuthMode | 'auto'> = ['auto', ...AUTH_MODES];

function nonEmpty(v: string | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function readEnv(): Parameters<typeof resolveAuthMode>[0] {
  const requested = (process.env.AUTH_MODE_REQUEST || 'auto').trim() as AuthMode | 'auto';
  if (!VALID_REQUEST_MODES.includes(requested)) {
    throw new Error(
      `AUTH_MODE_REQUEST=${requested} is not one of: ${VALID_REQUEST_MODES.join(', ')}`
    );
  }
  const fb = (process.env.PAT_FALLBACK_TO_GITHUB_TOKEN || 'true').trim().toLowerCase();
  // Default true: the App-fetch REST path (src/fetch/list-paginator-rest.ts)
  // is implemented. Set GITHUB_APP_SUPPORTS_FETCH=false to force auto to
  // skip github_app while debugging.
  const appFetch = (process.env.GITHUB_APP_SUPPORTS_FETCH || 'true').trim().toLowerCase();
  return {
    requested_mode: requested,
    star_source_user: process.env.STAR_SOURCE_USER || '',
    has_gh_app_client_id: nonEmpty(process.env.GH_APP_CLIENT_ID),
    has_gh_app_private_key: nonEmpty(process.env.GH_APP_PRIVATE_KEY),
    has_stars_token: nonEmpty(process.env.STARS_TOKEN),
    has_github_token: nonEmpty(process.env.GITHUB_TOKEN),
    pat_fallback_to_github_token: fb !== 'false' && fb !== '0' && fb !== 'no',
    github_app_supports_fetch: appFetch !== 'false' && appFetch !== '0' && appFetch !== 'no',
  };
}

export function renderSummary(r: ResolvedAuth): string {
  const lines: string[] = [];
  lines.push('## Auth setup-doctor');
  lines.push('');
  lines.push(`- **Selected mode**: \`${r.selected_mode}\`${r.degraded ? ' _(degraded)_' : ''}`);
  lines.push(`- **Requested**: \`${r.requested_mode}\``);
  lines.push(`- **Star source user**: \`${r.star_source_user || '(unset)'}\``);
  lines.push(`- **star_fetch_auth**: \`${r.star_fetch_auth}\``);
  lines.push(`- **repo_write_auth**: \`${r.repo_write_auth}\``);
  lines.push(`- **Reason**: ${r.reason}`);
  if (r.selected_mode === 'pat') {
    lines.push(
      `- **pat_fallback_to_github_token**: \`${r.pat_fallback_to_github_token}\` ` +
        `_(if PAT fails at runtime, ${r.pat_fallback_to_github_token ? 'transition effective_mode to github_token' : 'hard-fail'})_`
    );
  }
  lines.push('');
  lines.push('### Doctrine');
  lines.push('- Selected mode owns every role. star_fetch_auth and repo_write_auth must equal selected_mode.');
  lines.push('- `github_app` failure at runtime → hard-fail. NEVER falls back.');
  lines.push('- `pat` failure at runtime → loud transition to `effective_mode=github_token` if `pat_fallback_to_github_token=true`, else hard-fail.');
  lines.push('- `github_token` failure → hard-fail.');
  lines.push('- Fallback is reported as `effective_mode`, never as a mixed role-by-role auth.');
  lines.push('');
  return lines.join('\n');
}

export function writeJobOutputs(r: ResolvedAuth): void {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  // NOTE: per verdict rule 7, star_fetch_auth and repo_write_auth ALWAYS
  // equal selected_mode at config time. The CI gate validates this shape.
  const lines = [
    `selected_mode=${r.selected_mode}`,
    `requested_mode=${r.requested_mode}`,
    `star_source_user=${r.star_source_user}`,
    `star_fetch_auth=${r.star_fetch_auth}`,
    `repo_write_auth=${r.repo_write_auth}`,
    `degraded=${r.degraded}`,
    `pat_fallback_to_github_token=${r.pat_fallback_to_github_token}`,
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

  let r: ResolvedAuth;
  try {
    r = resolveAuthMode(inputs);
  } catch (err) {
    if (err instanceof AuthConfigError) {
      process.stderr.write(`::error::${err.message}\n`);
      process.stderr.write(`Missing config: ${err.missing_config.join(', ')}\n`);
      // Even on config error, write a minimal output so downstream steps
      // can branch on a 'failed' marker rather than crashing.
      const out = process.env.GITHUB_OUTPUT;
      if (out) {
        appendFileSync(
          out,
          [
            'selected_mode=',
            'requested_mode=' + (inputs.requested_mode || 'auto'),
            'star_source_user=' + (inputs.star_source_user || ''),
            'star_fetch_auth=',
            'repo_write_auth=',
            'degraded=true',
            'pat_fallback_to_github_token=false',
            'reason=' + oneLine(err.message),
            'config_error=true',
            'missing_config=' + err.missing_config.join(','),
          ].join('\n') + '\n'
        );
      }
      writeSummary(`## Auth setup-doctor — CONFIG ERROR\n\n- ${err.message}\n- Missing: ${err.missing_config.join(', ')}\n`);
      process.exit(1);
    }
    throw err;
  }

  process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  writeSummary(renderSummary(r));
  writeJobOutputs(r);

  if (r.degraded && strict) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('setup-doctor.ts')) {
  main();
}
