import { describe, expect, it } from "vitest";
import { buildBatchQuery } from "./metadata-batcher.js";

const FRAGMENT = `fragment RepoMetadata on Repository { isArchived }`;

describe("buildBatchQuery", () => {
	it("produces variable declarations and aliases for each batch item", () => {
		const q = buildBatchQuery(
			[
				{ owner: "a", name: "b" },
				{ owner: "c", name: "d" },
			],
			FRAGMENT,
		);
		expect(q).toContain("$o0: String!, $n0: String!");
		expect(q).toContain("$o1: String!, $n1: String!");
		expect(q).toContain(
			"r0: repository(owner: $o0, name: $n0) { ...RepoMetadata }",
		);
		expect(q).toContain(
			"r1: repository(owner: $o1, name: $n1) { ...RepoMetadata }",
		);
		expect(q.startsWith(FRAGMENT)).toBe(true);
	});

	it("handles a single-repo batch", () => {
		const q = buildBatchQuery([{ owner: "a", name: "b" }], FRAGMENT);
		expect(q).toContain("$o0: String!, $n0: String!");
		expect(q).toContain(
			"r0: repository(owner: $o0, name: $n0) { ...RepoMetadata }",
		);
		expect(q).not.toContain("$o1");
	});
});
