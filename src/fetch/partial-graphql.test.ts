import { describe, expect, it } from "vitest";
import {
	classifyPartial,
	errorStatus,
	isBadCredentials,
} from "./partial-graphql.js";

describe("classifyPartial", () => {
	it("returns null for non-graphql errors", () => {
		expect(classifyPartial(new Error("boom"))).toBeNull();
		expect(classifyPartial(null)).toBeNull();
	});

	it("extracts data when present alongside errors (org-blocked PAT case)", () => {
		const fakeError = {
			data: {
				viewer: {
					starredRepositories: { edges: [{ node: { nameWithOwner: "a/b" } }] },
				},
			},
			errors: [
				{
					message:
						"`acme-corp` forbids access via a personal access token (classic). Please use a fine-grained PAT.",
				},
			],
		};
		const r = classifyPartial(fakeError);
		expect(r).not.toBeNull();
		expect(r?.data).toEqual(fakeError.data);
		expect(r?.blockedOrgs).toEqual(["acme-corp"]);
		expect(r?.otherErrors).toEqual([]);
	});

	it("separates other errors from org-blocked ones", () => {
		const fakeError = {
			data: null,
			errors: [
				{
					message:
						"`org-x` forbids access via a personal access token (classic). foo",
				},
				{ message: "Some other rate-limit thing" },
			],
		};
		const r = classifyPartial(fakeError);
		expect(r?.blockedOrgs).toEqual(["org-x"]);
		expect(r?.otherErrors).toHaveLength(1);
		expect(r?.otherErrors[0]).toContain("rate-limit");
	});

	it("truncates long error messages", () => {
		const longMsg = "X".repeat(500);
		const r = classifyPartial({ data: null, errors: [{ message: longMsg }] });
		expect(r?.otherErrors[0].length).toBeLessThanOrEqual(200);
	});
});

describe("isBadCredentials", () => {
	it("detects Bad credentials in message", () => {
		expect(isBadCredentials({ message: "Bad credentials" })).toBe(true);
		expect(
			isBadCredentials({ message: "Server returned: Bad credentials." }),
		).toBe(true);
		expect(isBadCredentials({ message: "something else" })).toBe(false);
		expect(isBadCredentials({})).toBe(false);
	});
});

describe("errorStatus", () => {
	it("returns numeric status when present, n/a otherwise", () => {
		expect(errorStatus({ status: 502 })).toBe(502);
		expect(errorStatus({})).toBe("n/a");
		expect(errorStatus({ status: "oops" })).toBe("n/a");
	});
});
