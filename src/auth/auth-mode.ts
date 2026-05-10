// Auth mode types for the github-stars control plane.
//
// Per issue #69 doctrine: repo_write_auth != star_fetch_auth.
// One credential decision drives commits/PRs against this repo;
// a separate decision drives the GraphQL star fetch.
//
// Modes are explicit and named; no implicit fallback. The resolver
// in resolve-auth-mode.ts maps env+inputs -> ResolvedAuth, and the
// workflow consumes the resolution via setup-doctor's typed output.

export const AUTH_MODES = ['github_app', 'pat', 'public', 'github_token', 'disabled'] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

/** Inputs to the resolver. All fields optional; resolver decides. */
export type AuthResolverInputs = {
  /** workflow_dispatch input or schedule default. 'auto' = resolver picks. */
  requested_mode?: AuthMode | 'auto';
  /** GitHub user whose stars are fetched. */
  star_source_user?: string;

  /** Secrets/vars surface (presence checked, never values printed). */
  has_gh_app_client_id?: boolean;
  has_gh_app_private_key?: boolean;
  has_stars_token?: boolean;
  has_github_token?: boolean;
};

/** What the resolver decides for one role (fetch vs write). */
export type RoleAuth =
  | { source: 'github_app' }
  | { source: 'pat' }
  | { source: 'public' }
  | { source: 'github_token' }
  | { source: 'none' };

/** Final resolution. Workflow reads these outputs as job-level outputs. */
export type ResolvedAuth = {
  auth_mode: AuthMode;
  star_source_user: string;
  star_fetch_auth: RoleAuth;
  repo_write_auth: RoleAuth;
  /** True when a fallback was used because the preferred mode was unavailable. */
  degraded: boolean;
  /** Human-readable reason for the chosen mode (or for the fail). */
  reason: string;
  /** Names of required-but-missing config keys when auth_mode === 'disabled'. */
  missing_config: string[];
  /**
   * Capability matrix the doctor surfaces in $GITHUB_STEP_SUMMARY.
   * No values, only yes/no/blocked.
   */
  capabilities: {
    can_mint_app_token: 'yes' | 'no' | 'blocked';
    can_fetch_star_page: 'yes' | 'no' | 'blocked';
    can_checkout_target_repo: 'yes' | 'no' | 'blocked';
  };
};
