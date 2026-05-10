import { describe, expect, it } from "bun:test";
import { scrubAttribute } from "./scrub.js";

describe("scrubAttribute", () => {
	it("returns undefined for undefined input", () => {
		expect(scrubAttribute(undefined)).toBeUndefined();
	});

	it("returns empty string for empty input", () => {
		expect(scrubAttribute("")).toBe("");
	});

	it("passes through short non-secret strings", () => {
		expect(scrubAttribute("hello")).toBe("hello");
		expect(scrubAttribute("primeinc/github-stars")).toBe(
			"primeinc/github-stars",
		);
	});

	it("passes through posture-fact-shaped values (no redaction)", () => {
		// Categorically non-secret: short, no JWT shape, not long-blob.
		expect(scrubAttribute("github_app")).toBe("github_app");
		expect(scrubAttribute("Compliant")).toBe("Compliant");
	});

	it("redacts JWT-shape strings (length > 32, exactly two dots)", () => {
		const jwt =
			"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
		expect(scrubAttribute(jwt)).toBe("[REDACTED:jwt-shape]");
	});

	it("does NOT redact 32-char-or-shorter strings even with two dots", () => {
		// Boundary: length must be > 32 (strict) per C# port.
		const short = "abc.def.ghi"; // 11 chars, two dots
		expect(scrubAttribute(short)).toBe(short);
	});

	it("does NOT redact long strings with one dot (semver, hostnames)", () => {
		const semver = "1.0.0-beta.with-very-long-tag-name-that-exceeds-32-chars";
		expect(scrubAttribute(semver)).toBe(semver);
	});

	it("redacts long base64-ish blobs (>200 chars, >95% base64 alphabet)", () => {
		const blob = "A".repeat(250);
		expect(scrubAttribute(blob)).toBe("[REDACTED:long-blob]");
	});

	it("does NOT redact long strings that are mostly non-base64 (prose)", () => {
		// Spaces and punctuation knock the base64 ratio below the threshold.
		const prose =
			"This is a long human-readable sentence with spaces and punctuation, " +
			"intentionally exceeding 200 characters to verify that the scrubber " +
			"does not over-trigger on prose-shaped strings that happen to be long.";
		expect(scrubAttribute(prose)).toBe(prose);
	});

	it("handles base64url alphabet (- and _ allowed)", () => {
		const blob = `${"-".repeat(150)}${"_".repeat(105)}`;
		expect(scrubAttribute(blob)).toBe("[REDACTED:long-blob]");
	});
});
