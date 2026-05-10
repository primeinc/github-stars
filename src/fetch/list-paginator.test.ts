import { describe, expect, it, vi } from 'vitest';
import { paginateStarList } from './list-paginator.js';

const QUERY = 'query($cursor: String) { viewer { starredRepositories(after: $cursor) { __typename } } }';

function fakeOctokit(pages: Array<unknown>) {
  let callIndex = 0;
  return {
    graphql: vi.fn(async (_q: string, _vars: unknown) => {
      const page = pages[callIndex++];
      if (page instanceof Error) throw page;
      return page;
    }),
  } as unknown as Parameters<typeof paginateStarList>[0]['octokit'];
}

describe('paginateStarList', () => {
  it('walks pageInfo.hasNextPage to completion and excludes private repos', async () => {
    const oct = fakeOctokit([
      {
        viewer: {
          starredRepositories: {
            edges: [
              { node: { nameWithOwner: 'a/b', isPrivate: false }, starredAt: '2025-01-01T00:00:00Z' },
              { node: { nameWithOwner: 'c/d', isPrivate: true }, starredAt: '2025-01-02T00:00:00Z' },
            ],
            pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
            totalCount: 3,
          },
        },
      },
      {
        viewer: {
          starredRepositories: {
            edges: [
              { node: { nameWithOwner: 'e/f', isPrivate: false }, starredAt: '2025-01-03T00:00:00Z' },
            ],
            pageInfo: { hasNextPage: false, endCursor: 'cursor-2' },
            totalCount: 3,
          },
        },
      },
    ]);
    const r = await paginateStarList({ octokit: oct, query: QUERY, resumeCursor: null });
    expect(r.pageCount).toBe(2);
    expect(r.list).toEqual([
      { repo: 'a/b', user_starred_at: '2025-01-01T00:00:00Z' },
      { repo: 'e/f', user_starred_at: '2025-01-03T00:00:00Z' },
    ]);
    expect(r.partialFailureReason).toBe('');
    expect(r.lastEndCursor).toBe('cursor-2');
  });

  it('extracts partial data when graphql throws an org-blocked error', async () => {
    const orgBlockedErr = Object.assign(new Error('Request failed'), {
      data: {
        viewer: {
          starredRepositories: {
            edges: [{ node: { nameWithOwner: 'x/y', isPrivate: false }, starredAt: '2025-01-04T00:00:00Z' }],
            pageInfo: { hasNextPage: false, endCursor: 'cursor-end' },
            totalCount: 1,
          },
        },
      },
      errors: [{ message: '`acme-corp` forbids access via a personal access token (classic).' }],
    });
    const oct = fakeOctokit([orgBlockedErr]);
    const warns: string[] = [];
    const r = await paginateStarList({ octokit: oct, query: QUERY, resumeCursor: null, warn: (m) => warns.push(m) });
    expect(r.list).toEqual([{ repo: 'x/y', user_starred_at: '2025-01-04T00:00:00Z' }]);
    expect([...r.inaccessibleOrgs]).toEqual(['acme-corp']);
    expect(r.partialFailureReason).toBe('');
    expect(warns[0]).toContain('partial response');
  });

  it('hard-fails when error has no extractable data', async () => {
    const oct = fakeOctokit([Object.assign(new Error('502'), { status: 502 })]);
    const r = await paginateStarList({ octokit: oct, query: QUERY, resumeCursor: null });
    expect(r.partialFailureReason).toContain('list_error_at_page_1');
    expect(r.partialFailureReason).toContain('status=502');
    expect(r.list).toEqual([]);
  });

  it('resumes from the provided cursor', async () => {
    const oct = fakeOctokit([
      {
        viewer: {
          starredRepositories: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null },
            totalCount: 0,
          },
        },
      },
    ]);
    const r = await paginateStarList({ octokit: oct, query: QUERY, resumeCursor: 'mid-cursor' });
    expect(oct.graphql).toHaveBeenCalledWith(QUERY, { cursor: 'mid-cursor' });
    expect(r.pageCount).toBe(1);
  });
});
