// Pure resolver: env+inputs -> ResolvedAuth.
//
// Priority for `auto`:
//   1. github_app  if both client id + private key present
//   2. pat         if STARS_TOKEN present
//   3. public      if star_source_user present
//   4. github_token always degraded; only when nothing else applies
//   5. disabled    when nothing usable
//
// When the user explicitly requests a mode, only that mode is considered;
// missing config -> disabled with explicit missing_config list (never silent fallback).

import type { AuthResolverInputs, ResolvedAuth, RoleAuth } from './auth-mode.js';

const NO_AUTH: RoleAuth = { source: 'none' };

export function resolveAuthMode(inputs: AuthResolverInputs): ResolvedAuth {
  const star_source_user = (inputs.star_source_user || '').trim();
  const requested = inputs.requested_mode || 'auto';

  if (requested !== 'auto') {
    return resolveExplicit(requested, inputs, star_source_user);
  }

  if (inputs.has_gh_app_client_id && inputs.has_gh_app_private_key) {
    return ok('github_app', star_source_user, inputs, false, 'preferred mode (GitHub App configured)');
  }
  if (inputs.has_stars_token) {
    return ok('pat', star_source_user, inputs, true, 'STARS_TOKEN present, GitHub App not configured');
  }
  if (star_source_user) {
    return ok('public', star_source_user, inputs, true, 'no PAT and no App; falling back to public source');
  }
  if (inputs.has_github_token) {
    return ok('github_token', star_source_user, inputs, true,
      'last-resort: GITHUB_TOKEN identity will be used; this fetches the bot account stars, not the configured user');
  }
  return disabled(inputs, 'no usable credentials and no STAR_SOURCE_USER configured');
}

function resolveExplicit(mode: ResolvedAuth['auth_mode'], inputs: AuthResolverInputs, user: string): ResolvedAuth {
  switch (mode) {
    case 'github_app': {
      const missing: string[] = [];
      if (!inputs.has_gh_app_client_id) missing.push('GH_APP_CLIENT_ID');
      if (!inputs.has_gh_app_private_key) missing.push('GH_APP_PRIVATE_KEY');
      if (missing.length) return disabled(inputs, `github_app explicitly requested but missing: ${missing.join(', ')}`, missing);
      return ok('github_app', user, inputs, false, 'github_app explicitly requested');
    }
    case 'pat': {
      if (!inputs.has_stars_token) return disabled(inputs, 'pat explicitly requested but STARS_TOKEN missing', ['STARS_TOKEN']);
      return ok('pat', user, inputs, false, 'pat explicitly requested');
    }
    case 'public': {
      if (!user) return disabled(inputs, 'public explicitly requested but STAR_SOURCE_USER missing', ['STAR_SOURCE_USER']);
      return ok('public', user, inputs, false, 'public explicitly requested');
    }
    case 'github_token': {
      if (!inputs.has_github_token) return disabled(inputs, 'github_token explicitly requested but no GITHUB_TOKEN available', ['GITHUB_TOKEN']);
      return ok('github_token', user, inputs, true, 'github_token explicitly requested (degraded)');
    }
    case 'disabled':
      return disabled(inputs, 'auth explicitly disabled by request');
  }
}

function ok(
  mode: Exclude<ResolvedAuth['auth_mode'], 'disabled'>,
  user: string,
  inputs: AuthResolverInputs,
  degraded: boolean,
  reason: string
): ResolvedAuth {
  const fetch_auth = fetchAuthFor(mode, inputs);
  const write_auth = writeAuthFor(mode, inputs);
  return {
    auth_mode: mode,
    star_source_user: user,
    star_fetch_auth: fetch_auth,
    repo_write_auth: write_auth,
    degraded,
    reason,
    missing_config: [],
    capabilities: {
      can_mint_app_token: mode === 'github_app' ? 'yes' : 'no',
      // 'blocked' = required credential missing for the configured mode.
      // 'no'      = mode does not provide this capability (e.g. github_token
      //             cannot mint app tokens because that is structural).
      can_fetch_star_page: fetch_auth.source === 'none' ? 'blocked' : 'yes',
      can_checkout_target_repo: write_auth.source === 'none' ? 'blocked' : 'yes',
    },
  };
}

function disabled(inputs: AuthResolverInputs, reason: string, missing_config: string[] = []): ResolvedAuth {
  return {
    auth_mode: 'disabled',
    star_source_user: (inputs.star_source_user || '').trim(),
    star_fetch_auth: NO_AUTH,
    repo_write_auth: inputs.has_github_token ? { source: 'github_token' } : NO_AUTH,
    degraded: true,
    reason,
    missing_config,
    capabilities: {
      can_mint_app_token: missing_config.length ? 'blocked' : 'no',
      can_fetch_star_page: 'blocked',
      can_checkout_target_repo: inputs.has_github_token ? 'yes' : 'blocked',
    },
  };
}

/**
 * Star fetch and repo write may use different sources.
 * github_app for repo write is preferred; star fetch under app mode
 * still needs a user-context token, so it falls through to PAT or public.
 */
function fetchAuthFor(mode: Exclude<ResolvedAuth['auth_mode'], 'disabled'>, inputs: AuthResolverInputs): RoleAuth {
  switch (mode) {
    case 'github_app':
      // App installation tokens cannot enumerate user.starredRepositories;
      // need a user-context token. Prefer PAT; fall back to public if a user is set.
      if (inputs.has_stars_token) return { source: 'pat' };
      if (inputs.star_source_user) return { source: 'public' };
      return NO_AUTH;
    case 'pat':
      return { source: 'pat' };
    case 'public':
      return { source: 'public' };
    case 'github_token':
      return { source: 'github_token' };
  }
}

function writeAuthFor(mode: Exclude<ResolvedAuth['auth_mode'], 'disabled'>, inputs: AuthResolverInputs): RoleAuth {
  switch (mode) {
    case 'github_app':
      return { source: 'github_app' };
    case 'pat':
      // PAT can write too; preferred over the workflow identity for commits.
      return { source: 'pat' };
    case 'public':
      // Public-mode fetch still needs *something* to commit results back.
      return inputs.has_github_token ? { source: 'github_token' } : NO_AUTH;
    case 'github_token':
      return { source: 'github_token' };
  }
}
