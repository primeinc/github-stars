import { describe, expect, it } from 'vitest';
import { AuthConfigError, resolveAuthMode } from './resolve-auth-mode.js';
import { assertNoMixedAuth } from './auth-mode.js';

const base = { star_source_user: 'primeinc' };

describe('resolveAuthMode — auto priority', () => {
  it('App configured + github_app_supports_fetch=true + PAT → selected_mode=github_app, no PAT reference', () => {
    // Arrange
    const inputs = {
      ...base,
      has_gh_app_client_id: true,
      has_gh_app_private_key: true,
      github_app_supports_fetch: true,
      has_stars_token: true,
      has_github_token: true,
    };
    // Act
    const r = resolveAuthMode(inputs);
    // Assert
    expect(r.selected_mode).toBe('github_app');
    expect(r.star_fetch_auth).toBe('github_app');
    expect(r.repo_write_auth).toBe('github_app');
    expect(r.degraded).toBe(false);
    expect(r.pat_fallback_to_github_token).toBe(false); // not pat mode
  });

  it('App configured but github_app_supports_fetch=false + PAT → selected_mode=pat (auto skips App)', () => {
    // Doctrine: auto must not pick a mode that cannot complete every role.
    // The runtime fact that the App can't read viewer.starredRepositories
    // is encoded as github_app_supports_fetch=false (default) until the
    // App-fetch path is implemented.
    const inputs = {
      ...base,
      has_gh_app_client_id: true,
      has_gh_app_private_key: true,
      github_app_supports_fetch: false,
      has_stars_token: true,
    };
    const r = resolveAuthMode(inputs);
    expect(r.selected_mode).toBe('pat');
    expect(r.reason).toContain('github_app_supports_fetch=false');
  });

  it('App configured but github_app_supports_fetch=false + no PAT → falls all the way to github_token', () => {
    const r = resolveAuthMode({
      ...base,
      has_gh_app_client_id: true,
      has_gh_app_private_key: true,
      has_github_token: true,
      github_app_supports_fetch: false,
    });
    expect(r.selected_mode).toBe('github_token');
  });

  it('explicit github_app is still allowed even when github_app_supports_fetch=false (per doctrine: hard-fail at runtime)', () => {
    // Auto skips the App; but if the user explicitly asks for it, the
    // resolver MUST select it. The runtime then hard-fails loudly when
    // the App can't read viewer.starredRepositories — that IS the doctrine.
    const r = resolveAuthMode({
      ...base,
      requested_mode: 'github_app',
      has_gh_app_client_id: true,
      has_gh_app_private_key: true,
      github_app_supports_fetch: false,
    });
    expect(r.selected_mode).toBe('github_app');
  });

  it('PAT configured (App absent) → selected_mode=pat, pat owns all roles', () => {
    const r = resolveAuthMode({ ...base, has_stars_token: true });
    expect(r.selected_mode).toBe('pat');
    expect(r.star_fetch_auth).toBe('pat');
    expect(r.repo_write_auth).toBe('pat');
    expect(r.pat_fallback_to_github_token).toBe(true); // default on
  });

  it('Only GITHUB_TOKEN → selected_mode=github_token, degraded=true', () => {
    const r = resolveAuthMode({ has_github_token: true });
    expect(r.selected_mode).toBe('github_token');
    expect(r.star_fetch_auth).toBe('github_token');
    expect(r.repo_write_auth).toBe('github_token');
    expect(r.degraded).toBe(true);
  });

  it('No credentials at all → throws AuthConfigError naming what is missing', () => {
    expect(() => resolveAuthMode({})).toThrow(AuthConfigError);
  });

  it('Auto: when App auto-picks (supports_fetch=true), no PAT reference appears', () => {
    // Regression test for the prior bug where github_app + STARS_TOKEN
    // produced auth_mode=github_app + star_fetch_auth=pat.
    const r = resolveAuthMode({
      ...base,
      has_gh_app_client_id: true,
      has_gh_app_private_key: true,
      github_app_supports_fetch: true,
      has_stars_token: true,
    });
    expect(r.selected_mode).toBe('github_app');
    expect(r.star_fetch_auth).not.toBe('pat');
    expect(r.repo_write_auth).not.toBe('pat');
  });
});

describe('resolveAuthMode — explicit modes', () => {
  it('explicit github_app + missing private key → AuthConfigError', () => {
    expect(() =>
      resolveAuthMode({ ...base, requested_mode: 'github_app', has_gh_app_client_id: true })
    ).toThrow(AuthConfigError);
  });

  it('explicit pat + missing STARS_TOKEN → AuthConfigError', () => {
    expect(() => resolveAuthMode({ ...base, requested_mode: 'pat' })).toThrow(AuthConfigError);
  });

  it('explicit github_token + missing GITHUB_TOKEN → AuthConfigError', () => {
    expect(() => resolveAuthMode({ requested_mode: 'github_token' })).toThrow(AuthConfigError);
  });

  it('explicit github_app + valid → selected_mode=github_app even when PAT also present', () => {
    const r = resolveAuthMode({
      ...base,
      requested_mode: 'github_app',
      has_gh_app_client_id: true,
      has_gh_app_private_key: true,
      has_stars_token: true,
    });
    expect(r.selected_mode).toBe('github_app');
    expect(r.star_fetch_auth).toBe('github_app');
    expect(r.repo_write_auth).toBe('github_app');
  });

  it('explicit pat with pat_fallback_to_github_token=false → fallback flag respected', () => {
    const r = resolveAuthMode({
      ...base,
      requested_mode: 'pat',
      has_stars_token: true,
      pat_fallback_to_github_token: false,
    });
    expect(r.selected_mode).toBe('pat');
    expect(r.pat_fallback_to_github_token).toBe(false);
  });
});

describe('resolveAuthMode — invariant: no mixed-role auth is constructible', () => {
  it('every resolved auth has star_fetch_auth === repo_write_auth', () => {
    const cases = [
      // App auto-picked (supports_fetch=true)
      { ...base, has_gh_app_client_id: true, has_gh_app_private_key: true, github_app_supports_fetch: true },
      // PAT auto
      { ...base, has_stars_token: true },
      // GITHUB_TOKEN auto
      { has_github_token: true },
      // App config present + PAT — auto skips App because supports_fetch=false
      { ...base, has_gh_app_client_id: true, has_gh_app_private_key: true, has_stars_token: true, has_github_token: true },
      // Explicit pat
      { ...base, requested_mode: 'pat' as const, has_stars_token: true },
      // Explicit github_app even when supports_fetch=false (selectable; will hard-fail at runtime)
      { ...base, requested_mode: 'github_app' as const, has_gh_app_client_id: true, has_gh_app_private_key: true, github_app_supports_fetch: false },
    ];
    for (const inputs of cases) {
      const r = resolveAuthMode(inputs);
      expect(r.star_fetch_auth, `${JSON.stringify(inputs)}`).toBe(r.repo_write_auth);
    }
  });
});

describe('assertNoMixedAuth — runtime guard', () => {
  it('passes when both roles match', () => {
    expect(() => assertNoMixedAuth({ star_fetch_auth: 'pat', repo_write_auth: 'pat' })).not.toThrow();
  });
  it('throws on the laundering shape (github_app + pat)', () => {
    expect(() =>
      assertNoMixedAuth({ star_fetch_auth: 'pat', repo_write_auth: 'github_app' })
    ).toThrow(/Invalid mixed auth boundary/);
  });
  it('throws on any unequal pair', () => {
    expect(() =>
      assertNoMixedAuth({ star_fetch_auth: 'github_token', repo_write_auth: 'pat' })
    ).toThrow();
  });
});
