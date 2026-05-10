// bun gate — single readiness command.
//
// Runs each stage sequentially, fails fast, prints a summary table at
// the end. Each stage is a sub-process (via host-io's runCommandSync)
// so it can use whatever toolchain (tsc, bun test, biome, eslint,
// schema validator, actionlint) without polluting this process.

import { GENERATED_ARTIFACTS } from "../generated/registry.js";
import {
	joinPaths,
	listDirSync,
	pathExistsSync,
	platform,
	runCommandSync,
	setExitCode,
	writeStderr,
} from "../host-io/index.js";

type StageResult = {
	readonly name: string;
	readonly ok: boolean;
	readonly durationMs: number;
	readonly note?: string;
};

function runStage(
	name: string,
	fn: () => boolean | { ok: boolean; note?: string },
): StageResult {
	const t0 = Date.now();
	writeStderr(`\n=== gate stage: ${name} ===\n`);
	let ok = false;
	let note: string | undefined;
	try {
		const r = fn();
		if (typeof r === "boolean") ok = r;
		else {
			ok = r.ok;
			note = r.note;
		}
	} catch (err) {
		ok = false;
		note = (err as Error)?.message ?? String(err);
	}
	const durationMs = Date.now() - t0;
	writeStderr(
		`=== ${name}: ${ok ? "PASS" : "FAIL"} (${durationMs}ms)${note ? ` — ${note}` : ""} ===\n`,
	);
	const result: StageResult =
		note === undefined
			? { name, ok, durationMs }
			: { name, ok, durationMs, note };
	return result;
}

function bunRun(script: string): boolean {
	return runCommandSync("bun", ["run", script]).ok;
}

function actionlintAvailable(): boolean {
	const which = platform() === "win32" ? "where" : "which";
	return runCommandSync(which, ["actionlint"], { inheritStdio: false }).ok;
}

function actionlintAll(): { ok: boolean; note?: string } {
	if (!actionlintAvailable()) {
		return {
			ok: true,
			note: "actionlint not on PATH; skipping (CI installs it)",
		};
	}
	const dir = joinPaths(".github", "workflows");
	if (!pathExistsSync(dir)) return { ok: true, note: "no workflows dir" };
	const files = listDirSync(dir)
		.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
		.map((f) => joinPaths(dir, f));
	if (files.length === 0) return { ok: true, note: "no workflow files" };
	return { ok: runCommandSync("actionlint", files).ok };
}

function validateGeneratedRegistry(): { ok: boolean; note?: string } {
	const missing: string[] = [];
	for (const a of GENERATED_ARTIFACTS) {
		if (a.policy !== "committed") continue;
		if (!pathExistsSync(a.path)) missing.push(`${a.id} (${a.path})`);
	}
	return missing.length === 0
		? { ok: true }
		: { ok: false, note: `missing: ${missing.join(", ")}` };
}

function main(): void {
	const stages: StageResult[] = [];

	stages.push(runStage("typecheck", () => bunRun("typecheck")));
	if (!stages[stages.length - 1]?.ok) {
		finish(stages);
		return;
	}

	stages.push(runStage("lint", () => bunRun("lint")));
	if (!stages[stages.length - 1]?.ok) {
		finish(stages);
		return;
	}

	stages.push(runStage("test", () => bunRun("test")));
	if (!stages[stages.length - 1]?.ok) {
		finish(stages);
		return;
	}

	stages.push(
		runStage("validate (taxonomy + schema)", () => bunRun("validate")),
	);
	if (!stages[stages.length - 1]?.ok) {
		finish(stages);
		return;
	}

	stages.push(
		runStage("generated-artifacts registry", validateGeneratedRegistry),
	);
	if (!stages[stages.length - 1]?.ok) {
		finish(stages);
		return;
	}

	stages.push(runStage("actionlint (workflow YAML)", actionlintAll));

	finish(stages);
}

function finish(stages: StageResult[]): void {
	const totalMs = stages.reduce((acc, s) => acc + s.durationMs, 0);
	const allOk = stages.every((s) => s.ok);
	writeStderr("\n=== gate summary ===\n");
	for (const s of stages) {
		writeStderr(
			`  ${s.ok ? "PASS" : "FAIL"}  ${s.name.padEnd(36)} ${String(s.durationMs).padStart(6)}ms${s.note ? `  — ${s.note}` : ""}\n`,
		);
	}
	writeStderr(
		`  ----  ${"total".padEnd(36)} ${String(totalMs).padStart(6)}ms\n`,
	);
	writeStderr(`gate: ${allOk ? "PASS" : "FAIL"}\n`);
	setExitCode(allOk ? 0 : 1);
}

main();
