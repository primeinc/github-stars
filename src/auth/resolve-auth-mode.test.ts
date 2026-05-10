import { describe, expect, it } from 'vitest';
import { resolveAuthMode } from './resolve-auth-mode.js';

const base = { star_source_user: 'primeinc' };

describe('resolveAuthMode — auto', () => {
  it('prefers github_app when both app credentials present', () => {
    const r = resolveAuthMode({ ...base, has_gh_app_client_id: true, has_gh_app_private_key: true, has_stars_token: true });
    expect(r.auth_mode).toBe('github_app');
    expect(r.repo_write_auth.source).toBe('github_app');
    expect(r.degraded).toBe(false);
    // Star fetch under app mode falls through to PAT (apps can't read user.starredRepositories with installation tokens).
    expect(r.star_fetch_auth.source).toBe('pat');
  });

  it('falls back to pat when only PAT is present', () => {
    const r = resolveAuthMode({ ...base, has_stars_token: true });
    expect(r.auth_mode).toBe('pat');
    expect(r.degraded).toBe(true);
    expect(r.star_fetch_auth.source).toBe('pat');
    expect(r.repo_write_auth.source).toBe('pat');
  });

  it('falls back to public when only star_source_user is set', () => {
    const r = resolveAuthMode({ ...base });
    expect(r.auth_mode).toBe('public');
    expect(r.degraded).toBe(true);
    expect(r.star_fetch_auth.source).toBe('public');
    // No write auth available in pure public mode.
    expect(r.repo_write_auth.source).toBe('none');
  });

  it('uses github_token as last resort when no user is configured', () => {
    const r = resolveAuthMode({ has_github_token: true });
    expect(r.auth_mode).toBe('github_token');
    expect(r.degraded).toBe(true);
    expect(r.reason).toContain('GITHUB_TOKEN');
  });

  it('returns disabled when nothing usable', () => {
    const r = resolveAuthMode({});
    expect(r.auth_mode).toBe('disabled');
    expect(r.capabilities.can_fetch_star_page).toBe('blocked');
  });

  it('public + github_token → public wins, write uses GITHUB_TOKEN', () => {
    const r = resolveAuthMode({ ...base, has_github_token: true });
    expect(r.auth_mode).toBe('public');
    expect(r.repo_write_auth.source).toBe('github_token');
  });
});

describe('resolveAuthMode — explicit modes', () => {
  it('explicit github_app + missing private key → disabled with named gap', () => {
    const r = resolveAuthMode({ ...base, requested_mode: 'github_app', has_gh_app_client_id: true });
    expect(r.auth_mode).toBe('disabled');
    expect(r.missing_config).toEqual(['GH_APP_PRIVATE_KEY']);
    expect(r.capabilities.can_mint_app_token).toBe('blocked');
  });

  it('explicit pat + missing STARS_TOKEN → disabled with named gap', () => {
    const r = resolveAuthMode({ ...base, requested_mode: 'pat' });
    expect(r.auth_mode).toBe('disabled');
    expect(r.missing_config).toEqual(['STARS_TOKEN']);
  });

  it('explicit public + no user → disabled', () => {
    const r = resolveAuthMode({ requested_mode: 'public' });
    expect(r.auth_mode).toBe('disabled');
    expect(r.missing_config).toEqual(['STAR_SOURCE_USER']);
  });

  it('explicit pat with PAT present → pat (NOT degraded)', () => {
    const r = resolveAuthMode({ ...base, requested_mode: 'pat', has_stars_token: true });
    expect(r.auth_mode).toBe('pat');
    expect(r.degraded).toBe(false);
  });

  it('explicit github_token still flagged degraded with reason', () => {
    const r = resolveAuthMode({ ...base, requested_mode: 'github_token', has_github_token: true });
    expect(r.auth_mode).toBe('github_token');
    expect(r.degraded).toBe(true);
  });

  it('explicit disabled → disabled with reason', () => {
    const r = resolveAuthMode({ requested_mode: 'disabled' });
    expect(r.auth_mode).toBe('disabled');
    expect(r.reason).toContain('disabled by request');
  });
});

describe('resolveAuthMode — capabilities matrix', () => {
  it('reports can_mint_app_token=yes only under github_app', () => {
    const app = resolveAuthMode({ ...base, has_gh_app_client_id: true, has_gh_app_private_key: true });
    expect(app.capabilities.can_mint_app_token).toBe('yes');
    const pat = resolveAuthMode({ ...base, has_stars_token: true });
    expect(pat.capabilities.can_mint_app_token).toBe('no');
  });

  it('reports can_checkout_target_repo=yes when any write auth is available', () => {
    const r = resolveAuthMode({ ...base, has_stars_token: true });
    expect(r.capabilities.can_checkout_target_repo).toBe('yes');
  });

  it('reports can_checkout_target_repo=blocked when no write auth at all', () => {
    const r = resolveAuthMode({ ...base });
    expect(r.capabilities.can_checkout_target_repo).toBe('blocked');
  });
});
