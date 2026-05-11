import { describe, expect, it } from "bun:test";
import {
	evaluateLooseZod,
	isExcluded,
	scanText,
	stripStringsAndComments,
} from "./no-loose-zod.js";

describe("isExcluded", () => {
	it("returns true for node_modules paths", () => {
		expect(isExcluded("node_modules/foo/index.ts")).toBe(true);
		expect(isExcluded("packages/x/node_modules/y.ts")).toBe(true);
	});

	it("returns true for dist / generated / coverage / web / docs", () => {
		expect(isExcluded("dist/main.js")).toBe(true);
		expect(isExcluded("generated/paths.json")).toBe(true);
		expect(isExcluded("coverage/lcov.info")).toBe(true);
		expect(isExcluded("web/src/App.jsx")).toBe(true);
		expect(isExcluded("docs/data.json")).toBe(true);
	});

	it("returns false for in-scope src paths", () => {
		expect(isExcluded("src/contracts/registry.ts")).toBe(false);
		expect(isExcluded("src/auth/setup-doctor.ts")).toBe(false);
	});
});

describe("stripStringsAndComments", () => {
	it("preserves length so line numbers stay accurate", () => {
		const src = "const x = 'hello';\nconst y = 1; // comment\n";
		const stripped = stripStringsAndComments(src);
		expect(stripped.length).toBe(src.length);
	});

	it("preserves newlines inside line comments", () => {
		const src = "// line one\nconst x = 1;\n";
		const stripped = stripStringsAndComments(src);
		expect(stripped.split("\n").length).toBe(src.split("\n").length);
	});

	it("wipes z.any inside a single-quoted string", () => {
		const src = "const docstring = 'use z.any() in tests';\n";
		const stripped = stripStringsAndComments(src);
		expect(stripped).not.toContain("z.any(");
	});

	it("wipes z.unknown inside a line comment", () => {
		const src = "// avoid z.unknown() outside contracts\n";
		const stripped = stripStringsAndComments(src);
		expect(stripped).not.toContain("z.unknown(");
	});

	it("wipes z.any inside a block comment", () => {
		const src = "/* z.any() is banned */\nconst x = 1;\n";
		const stripped = stripStringsAndComments(src);
		expect(stripped).not.toContain("z.any(");
	});

	it("preserves call-site z.any outside strings/comments", () => {
		const src = "const s = z.any();\n";
		const stripped = stripStringsAndComments(src);
		expect(stripped).toContain("z.any(");
	});
});

describe("scanText", () => {
	it("flags z.any() at a call site", () => {
		const result = scanText({
			path: "src/foo.ts",
			source: "const s = z.any();\n",
		});
		expect(result).toHaveLength(1);
		expect(result[0]?.token).toBe("z.any(");
		expect(result[0]?.line).toBe(1);
		expect(result[0]?.path).toBe("src/foo.ts");
	});

	it("flags z.unknown() at a call site", () => {
		const result = scanText({
			path: "src/bar.ts",
			source: "\nconst s = z.unknown();\n",
		});
		expect(result).toHaveLength(1);
		expect(result[0]?.token).toBe("z.unknown(");
		expect(result[0]?.line).toBe(2);
	});

	it("does NOT flag z.any inside a string literal", () => {
		const result = scanText({
			path: "src/foo.ts",
			source: 'const docstring = "z.any() is banned";\n',
		});
		expect(result).toHaveLength(0);
	});

	it("does NOT flag z.any inside a comment", () => {
		const result = scanText({
			path: "src/foo.ts",
			source: "// z.any() is banned\nconst x = 1;\n",
		});
		expect(result).toHaveLength(0);
	});

	it("flags multiple tokens on different lines", () => {
		const result = scanText({
			path: "src/foo.ts",
			source: "const a = z.any();\nconst b = z.unknown();\n",
		});
		expect(result).toHaveLength(2);
	});
});

describe("evaluateLooseZod", () => {
	it("returns clean summary on zero findings", () => {
		const result = evaluateLooseZod({
			sources: [{ path: "src/clean.ts", source: "const x = z.string();\n" }],
		});
		expect(result.findings).toHaveLength(0);
		expect(result.summary).toContain("0 loose-zod");
	});

	it("aggregates findings across multiple sources", () => {
		const result = evaluateLooseZod({
			sources: [
				{ path: "src/a.ts", source: "const x = z.any();\n" },
				{ path: "src/b.ts", source: "const y = z.unknown();\n" },
			],
		});
		expect(result.findings).toHaveLength(2);
		expect(result.summary).toContain("2 loose-zod");
	});
});
