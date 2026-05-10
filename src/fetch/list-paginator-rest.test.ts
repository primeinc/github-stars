import { describe, expect, it, vi } from "vitest";
import {
	paginateStarListViaRest,
	parseRestResumeToken,
} from "./list-paginator-rest.js";

function fakeOctokit(pages: Array<unknown>) {
	let i = 0;
	return {
		request: vi.fn(async (route: string, _params: Record<string, unknown>) => {
			const p = pages[i++];
			if (p instanceof Error) throw p;
			return { data: p, status: 200, url: route, headers: {} };
		}),
	} as unknown as Parameters<typeof paginateStarListViaRest>[0]["octokit"];
}

describe("paginateStarListViaRest", () => {
	it("walks pages until a partial-fill page (REST has no cursor) and excludes private repos", async () => {
		// Arrange: page 1 full (per_page=2 fake), page 2 partial → end.
		const oct = fakeOctokit([
			[
				{
					starred_at: "2025-01-01T00:00:00Z",
					repo: { full_name: "a/b", private: false },
				},
				{
					starred_at: "2025-01-02T00:00:00Z",
					repo: { full_name: "c/d", private: true },
				},
			],
			[
				{
					starred_at: "2025-01-03T00:00:00Z",
					repo: { full_name: "e/f", private: false },
				},
			],
		]);
		// Act
		const r = await paginateStarListViaRest({
			octokit: oct,
			username: "primeinc",
			perPage: 2,
		});
		// Assert
		expect(r.pageCount).toBe(2);
		expect(r.list).toEqual([
			{ repo: "a/b", user_starred_at: "2025-01-01T00:00:00Z" },
			{ repo: "e/f", user_starred_at: "2025-01-03T00:00:00Z" },
		]);
		expect(r.partialFailureReason).toBe("");
		expect(r.resumeToken).toBeNull();
	});

	it("passes the star+json Accept header (needed for starred_at field)", async () => {
		const oct = fakeOctokit([[]]);
		await paginateStarListViaRest({
			octokit: oct,
			username: "primeinc",
			perPage: 2,
		});
		expect(oct.request).toHaveBeenCalledWith(
			"GET /users/{username}/starred",
			expect.objectContaining({
				username: "primeinc",
				per_page: 2,
				page: 1,
				headers: { accept: "application/vnd.github.star+json" },
			}),
		);
	});

	it("hard-fails with a usable resume token when a request errors", async () => {
		const err = Object.assign(new Error("502 Bad Gateway"), { status: 502 });
		const oct = fakeOctokit([
			[
				{
					starred_at: "2025-01-01T00:00:00Z",
					repo: { full_name: "a/b", private: false },
				},
			],
			err,
		]);
		const r = await paginateStarListViaRest({
			octokit: oct,
			username: "primeinc",
			perPage: 1,
		});
		expect(r.partialFailureReason).toContain("rest_list_error_at_page_2");
		expect(r.partialFailureReason).toContain("status=502");
		expect(r.resumeToken).toBe("2");
		expect(r.list).toHaveLength(1);
	});

	it("startPage is honored for resume", async () => {
		const oct = fakeOctokit([[]]);
		await paginateStarListViaRest({
			octokit: oct,
			username: "primeinc",
			startPage: 7,
			perPage: 100,
		});
		expect(oct.request).toHaveBeenCalledWith(
			"GET /users/{username}/starred",
			expect.objectContaining({ page: 7 }),
		);
	});

	it("treats invalid (non-array) response shape as a hard failure", async () => {
		const oct = fakeOctokit([{ message: "something else" }]);
		const r = await paginateStarListViaRest({
			octokit: oct,
			username: "primeinc",
			perPage: 100,
		});
		expect(r.partialFailureReason).toContain("rest_list_invalid_response");
	});
});

describe("parseRestResumeToken", () => {
	it("null and empty string return 1 (start page)", () => {
		expect(parseRestResumeToken(null)).toBe(1);
		expect(parseRestResumeToken("")).toBe(1);
	});
	it("valid integer string returns the integer", () => {
		expect(parseRestResumeToken("5")).toBe(5);
	});
	it("garbage returns 1 (defensive)", () => {
		expect(parseRestResumeToken("abc")).toBe(1);
		expect(parseRestResumeToken("-3")).toBe(1);
	});
});
