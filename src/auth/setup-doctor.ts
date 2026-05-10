// setup-doctor — resolves auth mode at config time, emits the strict shape.
//
// Per session-oracle verdict, the doctor outputs:
//   - selected_mode (the credential class chosen at config time)
//   - star_fetch_auth, repo_write_auth (always == selected_mode; no mixing)
//   - pat_fallback_to_github_token (bool; only meaningful for pat mode)
//   - degraded (true iff selected_mode == github_token)
//   - reason
//
// The runtime fallback transition happens INSIDE the fetch/sync CLIs and
// is reported by THEM, not here. The doctor only reports the config-time
// selection.
//
// Env reads go through GhStarsEnv (src/contracts/env.ts) so every
// reference is a typed lookup against the env-key registry. zod-config's
// envAdapter parses the raw env into a strict-validated DoctorEnv shape
// at the boundary; downstream code sees the typed shape, not raw strings.

import * as z from "zod";
import { GhStarsEnv } from "../contracts/env.js";
import { GhStarsSchemaRegistry } from "../contracts/registry.js";
import {
	appendFileTextSync,
	exit,
	getEnv,
	processArgv,
	setExitCode,
	writeStderr,
	writeStdoutLine,
} from "../host-io/index.js";
import { AUTH_MODES, type AuthMode, type ResolvedAuth } from "./auth-mode.js";
import { AuthConfigError, resolveAuthMode } from "./resolve-auth-mode.js";

const VALID_REQUEST_MODES: ReadonlyArray<AuthMode | "auto"> = [
	"auto",
	...AUTH_MODES,
];

/**
 * Strict-validated env shape consumed by {@link readDoctorInputs}. Built
 * from raw env via boundary-parse with `DoctorEnvSchema`; downstream
 * helpers see only this typed surface.
 *
 * @public
 */
export const DoctorEnvSchema = z
	.strictObject({
		[GhStarsEnv.authModeRequest]: z.string().trim().optional(),
		[GhStarsEnv.starSourceUser]: z.string().trim().optional(),
		[GhStarsEnv.ghAppClientId]: z.string().trim().optional(),
		[GhStarsEnv.ghAppPrivateKey]: z.string().trim().optional(),
		[GhStarsEnv.starsToken]: z.string().trim().optional(),
		[GhStarsEnv.githubToken]: z.string().trim().optional(),
		[GhStarsEnv.patFallbackToGithubToken]: z.string().trim().optional(),
		[GhStarsEnv.githubAppSupportsFetch]: z.string().trim().optional(),
	})
	.register(GhStarsSchemaRegistry, {
		id: "contract.github-stars.auth.doctor-env.v1",
		title: "github-stars Setup-Doctor Env",
		description:
			"Strict env shape consumed by setup-doctor. Boundary-validated; downstream helpers see typed values.",
		owner: "src/auth/setup-doctor.ts",
		version: "1.0.0",
		stability: "p1",
	});

/**
 * Inferred TS type for the validated doctor env.
 *
 * @public
 */
export type DoctorEnv = z.infer<typeof DoctorEnvSchema>;

function nonEmpty(v: string | undefined): boolean {
	return typeof v === "string" && v.trim().length > 0;
}

function readDoctorInputs(): Parameters<typeof resolveAuthMode>[0] {
	// Read raw env via the catalog so every key reference is a typed
	// lookup against GhStarsEnvKey, then boundary-parse via Zod so any
	// shape drift fails immediately instead of deep in the resolver.
	const raw: Record<string, string | undefined> = {
		[GhStarsEnv.authModeRequest]: getEnv(GhStarsEnv.authModeRequest),
		[GhStarsEnv.starSourceUser]: getEnv(GhStarsEnv.starSourceUser),
		[GhStarsEnv.ghAppClientId]: getEnv(GhStarsEnv.ghAppClientId),
		[GhStarsEnv.ghAppPrivateKey]: getEnv(GhStarsEnv.ghAppPrivateKey),
		[GhStarsEnv.starsToken]: getEnv(GhStarsEnv.starsToken),
		[GhStarsEnv.githubToken]: getEnv(GhStarsEnv.githubToken),
		[GhStarsEnv.patFallbackToGithubToken]: getEnv(
			GhStarsEnv.patFallbackToGithubToken,
		),
		[GhStarsEnv.githubAppSupportsFetch]: getEnv(
			GhStarsEnv.githubAppSupportsFetch,
		),
	};
	const env: DoctorEnv = DoctorEnvSchema.parse(raw);

	const requestedRaw = (env[GhStarsEnv.authModeRequest] ?? "auto").trim() as
		| AuthMode
		| "auto";
	if (!VALID_REQUEST_MODES.includes(requestedRaw)) {
		throw new Error(
			`AUTH_MODE_REQUEST=${requestedRaw} is not one of: ${VALID_REQUEST_MODES.join(", ")}`,
		);
	}
	const fb = (env[GhStarsEnv.patFallbackToGithubToken] ?? "true")
		.trim()
		.toLowerCase();
	const appFetch = (env[GhStarsEnv.githubAppSupportsFetch] ?? "true")
		.trim()
		.toLowerCase();
	return {
		requested_mode: requestedRaw,
		star_source_user: env[GhStarsEnv.starSourceUser] ?? "",
		has_gh_app_client_id: nonEmpty(env[GhStarsEnv.ghAppClientId]),
		has_gh_app_private_key: nonEmpty(env[GhStarsEnv.ghAppPrivateKey]),
		has_stars_token: nonEmpty(env[GhStarsEnv.starsToken]),
		has_github_token: nonEmpty(env[GhStarsEnv.githubToken]),
		pat_fallback_to_github_token: fb !== "false" && fb !== "0" && fb !== "no",
		github_app_supports_fetch:
			appFetch !== "false" && appFetch !== "0" && appFetch !== "no",
	};
}

/**
 * Render the markdown summary block for {@link writeSummary}.
 *
 * @public
 */
export function renderSummary(r: ResolvedAuth): string {
	const lines: string[] = [];
	lines.push("## Auth setup-doctor");
	lines.push("");
	lines.push(
		`- **Selected mode**: \`${r.selected_mode}\`${r.degraded ? " _(degraded)_" : ""}`,
	);
	lines.push(`- **Requested**: \`${r.requested_mode}\``);
	lines.push(`- **Star source user**: \`${r.star_source_user || "(unset)"}\``);
	lines.push(`- **star_fetch_auth**: \`${r.star_fetch_auth}\``);
	lines.push(`- **repo_write_auth**: \`${r.repo_write_auth}\``);
	lines.push(`- **Reason**: ${r.reason}`);
	if (r.selected_mode === "pat") {
		lines.push(
			`- **pat_fallback_to_github_token**: \`${r.pat_fallback_to_github_token}\` ` +
				`_(if PAT fails at runtime, ${r.pat_fallback_to_github_token ? "transition effective_mode to github_token" : "hard-fail"})_`,
		);
	}
	lines.push("");
	lines.push("### Doctrine");
	lines.push(
		"- Selected mode owns every role. star_fetch_auth and repo_write_auth must equal selected_mode.",
	);
	lines.push(
		"- `github_app` failure at runtime → hard-fail. NEVER falls back.",
	);
	lines.push(
		"- `pat` failure at runtime → loud transition to `effective_mode=github_token` if `pat_fallback_to_github_token=true`, else hard-fail.",
	);
	lines.push("- `github_token` failure → hard-fail.");
	lines.push(
		"- Fallback is reported as `effective_mode`, never as a mixed role-by-role auth.",
	);
	lines.push("");
	return lines.join("\n");
}

/**
 * Append the strict GitHub-Actions outputs block to GITHUB_OUTPUT.
 *
 * @public
 */
export function writeJobOutputs(r: ResolvedAuth): void {
	const out = getEnv(GhStarsEnv.githubOutput);
	if (!out) return;
	const lines = [
		`selected_mode=${r.selected_mode}`,
		`requested_mode=${r.requested_mode}`,
		`star_source_user=${r.star_source_user}`,
		`star_fetch_auth=${r.star_fetch_auth}`,
		`repo_write_auth=${r.repo_write_auth}`,
		`degraded=${r.degraded}`,
		`pat_fallback_to_github_token=${r.pat_fallback_to_github_token}`,
		`reason=${oneLine(r.reason)}`,
	];
	appendFileTextSync(out, `${lines.join("\n")}\n`);
}

function writeSummary(md: string): void {
	const summary = getEnv(GhStarsEnv.githubStepSummary);
	if (!summary) return;
	appendFileTextSync(summary, `${md}\n`);
}

function oneLine(s: string): string {
	return s.replace(/[\r\n]+/g, " ").trim();
}

function main(): void {
	const argv = processArgv();
	const strict = argv.includes("--strict");
	const inputs = readDoctorInputs();

	let r: ResolvedAuth;
	try {
		r = resolveAuthMode(inputs);
	} catch (err) {
		if (err instanceof AuthConfigError) {
			writeStderr(`::error::${err.message}\n`);
			writeStderr(`Missing config: ${err.missing_config.join(", ")}\n`);
			const out = getEnv(GhStarsEnv.githubOutput);
			if (out) {
				appendFileTextSync(
					out,
					`${[
						"selected_mode=",
						`requested_mode=${inputs.requested_mode || "auto"}`,
						`star_source_user=${inputs.star_source_user || ""}`,
						"star_fetch_auth=",
						"repo_write_auth=",
						"degraded=true",
						"pat_fallback_to_github_token=false",
						`reason=${oneLine(err.message)}`,
						"config_error=true",
						`missing_config=${err.missing_config.join(",")}`,
					].join("\n")}\n`,
				);
			}
			writeSummary(
				`## Auth setup-doctor — CONFIG ERROR\n\n- ${err.message}\n- Missing: ${err.missing_config.join(", ")}\n`,
			);
			exit(1);
		}
		throw err;
	}

	writeStdoutLine(JSON.stringify(r, null, 2));
	writeSummary(renderSummary(r));
	writeJobOutputs(r);

	if (r.degraded && strict) {
		setExitCode(1);
	}
}

if (argv1EndsWith("setup-doctor.ts")) {
	main();
}

function argv1EndsWith(suffix: string): boolean {
	const argv = processArgv();
	return argv[1]?.endsWith(suffix) ?? false;
}
