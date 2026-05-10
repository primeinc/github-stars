// Shape of one transformed repo entry the fetcher emits.
// Keep in sync with the schema 02-sync consumes.

export type FetchedRepo = {
  repo: string;
  description: string;
  language: string | null;
  topics: string[];
  archived: boolean;
  fork: boolean;
  private: boolean;
  stargazers_count: number;
  forks_count: number;
  updated_at: string | null;
  pushed_at: string | null;
  disk_usage: number | null;
  owner_avatar: string | null;
  html_url: string | null;
  default_branch: string;
  last_commit_sha: string | null;
  user_starred_at: string | null;
  homepage_url: string | null;
  is_mirror: boolean;
  mirror_url: string | null;
  license: string | null;
  latest_release: { tag: string; published_at: string } | null;
};

export type StarListEntry = { repo: string; user_starred_at: string };

export type FetchOutcome = {
  repos: FetchedRepo[];
  pageCount: number;
  batchCount: number;
  lastEndCursor: string | null;
  /** Orgs that block classic-PAT access. Repos in those orgs are skipped. */
  inaccessibleOrgs: string[];
  /** Non-empty when the fetch could not complete; workflow must hard-fail. */
  partialFailureReason: string;
};
