// Partial-GraphQL handling.
//
// @octokit/graphql throws GraphqlResponseError when response.data.errors
// is populated, but preserves response.data on the error object
// (refs/octokit/.../@octokit/graphql/dist-src/error.js L11-12 sets
// this.data = response.data). For org-blocked classic-PAT errors,
// GitHub returns the page that succeeded plus per-repo error entries.
// This module classifies and extracts both shapes.

const ORG_BLOCKED_REGEX = /^`([^`]+)` forbids access via a personal access token \(classic\)/;
const MAX_ERROR_MSG_LENGTH = 200;

export type PartialClassification = {
  /** Best-effort partial data the caller can still use. null = nothing usable. */
  data: unknown;
  /** Org names that block classic-PAT access. Caller accumulates across pages. */
  blockedOrgs: string[];
  /** Other GraphQL error messages (truncated). */
  otherErrors: string[];
};

export function classifyPartial(error: unknown): PartialClassification | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { data?: unknown; errors?: Array<{ message?: string }> };
  if (e.data == null && e.errors == null) return null;

  const blockedOrgs: string[] = [];
  const otherErrors: string[] = [];
  for (const item of e.errors ?? []) {
    const msg = (item?.message ?? '').toString();
    const m = msg.match(ORG_BLOCKED_REGEX);
    if (m) blockedOrgs.push(m[1]);
    else otherErrors.push(msg.substring(0, MAX_ERROR_MSG_LENGTH));
  }
  return { data: e.data ?? null, blockedOrgs, otherErrors };
}

export function isBadCredentials(error: unknown): boolean {
  const msg = (error as { message?: unknown })?.message;
  return typeof msg === 'string' && msg.includes('Bad credentials');
}

export function errorStatus(error: unknown): number | string {
  const s = (error as { status?: unknown })?.status;
  return typeof s === 'number' ? s : 'n/a';
}

export function errorMessage(error: unknown): string {
  const m = (error as { message?: unknown })?.message;
  const s = typeof m === 'string' ? m : String(error);
  return s.substring(0, MAX_ERROR_MSG_LENGTH);
}
