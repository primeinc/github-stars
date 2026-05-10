import { describe, expect, it, vi } from "vitest";
import type { ResolvedAuth } from "./auth-mode.js";
import {
	applyRuntimeFailure,
	type RuntimeContext,
	startEffective,
} from "./runtime-state.js";

function resolved(
	selected: "github_app" | "pat" | "github_token",
	pat_fallback = true,
): ResolvedAuth {
	return {
		requested_mode: "auto",
		selected_mode: selected,
		star_fetch_auth: selected,
		repo_write_auth: selected,
		star_source_user: "primeinc",
		pat_fallback_to_github_token: selected === "pat" ? pat_fallback : false,
		degraded: selected === "github_token",
		reason: "test",
		missing_config: [],
	};
}

describe("startEffective", () => {
	it("initializes effective_mode === selected_mode and fallback_fired=false", () => {
		const r = resolved("pat");
		const e = startEffective(r);
		expect(e.effective_mode).toBe("pat");
		expect(e.fallback_fired).toBe(false);
		expect(e.star_fetch_auth).toBe(e.repo_write_auth);
	});
});

describe("applyRuntimeFailure — github_app", () => {
	it("always re-throws (NEVER falls back, even if GITHUB_TOKEN available)", () => {
		// Arrange
		const e = startEffective(resolved("github_app"));
		const ctx: RuntimeContext = {
			has_github_token_at_runtime: true,
			warn: vi.fn(),
		};
		const failure = {
			role: "star_fetch" as const,
			attempted: "github_app" as const,
			error: new Error("app failed"),
		};
		// Act + Assert
		expect(() => applyRuntimeFailure(e, failure, ctx)).toThrow("app failed");
		expect(ctx.warn).not.toHaveBeenCalled();
	});
});

describe("applyRuntimeFailure — pat", () => {
	it("falls back to github_token loudly when flag=true and GITHUB_TOKEN present", () => {
		// Arrange
		const e = startEffective(resolved("pat", true));
		const warn = vi.fn();
		const ctx: RuntimeContext = { has_github_token_at_runtime: true, warn };
		const failure = {
			role: "star_fetch" as const,
			attempted: "pat" as const,
			error: new Error("Bad credentials"),
		};
		// Act
		const next = applyRuntimeFailure(e, failure, ctx);
		// Assert — fallback fired AND every role flipped (no mixing)
		expect(next.fallback_fired).toBe(true);
		expect(next.effective_mode).toBe("github_token");
		expect(next.star_fetch_auth).toBe("github_token");
		expect(next.repo_write_auth).toBe("github_token");
		expect(next.degraded).toBe(true);
		expect(next.selected_mode).toBe("pat"); // selected unchanged; effective is what changed
		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0][0]).toContain("pat-mode runtime failure");
		expect(warn.mock.calls[0][0]).toContain(
			"transitioning effective_mode to github_token",
		);
	});

	it("hard-fails when pat_fallback_to_github_token=false", () => {
		const e = startEffective(resolved("pat", false));
		const warn = vi.fn();
		const ctx: RuntimeContext = { has_github_token_at_runtime: true, warn };
		const failure = {
			role: "star_fetch" as const,
			attempted: "pat" as const,
			error: new Error("Bad credentials"),
		};
		expect(() => applyRuntimeFailure(e, failure, ctx)).toThrow(
			"Bad credentials",
		);
		expect(warn).not.toHaveBeenCalled();
	});

	it("hard-fails when GITHUB_TOKEN is not available at runtime", () => {
		const e = startEffective(resolved("pat", true));
		const ctx: RuntimeContext = { has_github_token_at_runtime: false };
		const failure = {
			role: "star_fetch" as const,
			attempted: "pat" as const,
			error: new Error("Bad credentials"),
		};
		expect(() => applyRuntimeFailure(e, failure, ctx)).toThrow(
			"Bad credentials",
		);
	});

	it("only one fallback transition per run — second failure under github_token re-throws", () => {
		const e0 = startEffective(resolved("pat", true));
		const ctx: RuntimeContext = {
			has_github_token_at_runtime: true,
			warn: vi.fn(),
		};
		const e1 = applyRuntimeFailure(
			e0,
			{ role: "star_fetch", attempted: "pat", error: new Error("first") },
			ctx,
		);
		expect(e1.effective_mode).toBe("github_token");
		expect(() =>
			applyRuntimeFailure(
				e1,
				{
					role: "repo_write",
					attempted: "github_token",
					error: new Error("second"),
				},
				ctx,
			),
		).toThrow("second");
	});
});

describe("applyRuntimeFailure — github_token", () => {
	it("always re-throws (no further fallback target)", () => {
		const e = startEffective(resolved("github_token"));
		const ctx: RuntimeContext = {
			has_github_token_at_runtime: true,
			warn: vi.fn(),
		};
		const failure = {
			role: "repo_write" as const,
			attempted: "github_token" as const,
			error: new Error("token failed"),
		};
		expect(() => applyRuntimeFailure(e, failure, ctx)).toThrow("token failed");
	});
});

describe("summary invariant — no mixed-auth shape ever escapes the layer", () => {
	it("after fallback, both star_fetch_auth and repo_write_auth match effective_mode", () => {
		const e0 = startEffective(resolved("pat", true));
		const ctx: RuntimeContext = {
			has_github_token_at_runtime: true,
			warn: vi.fn(),
		};
		const e1 = applyRuntimeFailure(
			e0,
			{ role: "star_fetch", attempted: "pat", error: new Error("x") },
			ctx,
		);
		expect(e1.star_fetch_auth).toBe(e1.effective_mode);
		expect(e1.repo_write_auth).toBe(e1.effective_mode);
	});
});
