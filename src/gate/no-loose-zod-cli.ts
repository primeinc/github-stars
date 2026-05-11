#!/usr/bin/env bun
// Runner for the no-loose-zod gate. Walks `src/**`, reads each .ts /
// .tsx file, hands sources to evaluateLooseZod, and prints findings
// in the operator's preferred shape (one finding per line; total + a
// PASS/FAIL banner at the end).
//
// Exit code: 0 when zero findings, 1 otherwise — usable as a gate
// stage from `src/gate/cli.ts`.

import {
	exit,
	cwd as hostCwd,
	joinPaths,
	readTextFileSync,
	relativePath,
	walkFilesSync,
	writeStdoutLine,
} from "../host-io/index.js";
import { evaluateLooseZod, isExcluded } from "./no-loose-zod.js";

function findScanRoots(): string[] {
	return [joinPaths(hostCwd(), "src")];
}

function gatherSources(): Array<{ path: string; source: string }> {
	const sources: Array<{ path: string; source: string }> = [];
	for (const root of findScanRoots()) {
		const files = walkFilesSync(root, {
			includeFile: ({ name }) =>
				(name.endsWith(".ts") || name.endsWith(".tsx")) &&
				!name.endsWith(".d.ts"),
			skipDir: ({ name }) =>
				name === "node_modules" ||
				name === "dist" ||
				name === "generated" ||
				name === "coverage",
		});
		for (const abs of files) {
			const rel = relativePath(hostCwd(), abs).replaceAll("\\", "/");
			if (isExcluded(rel)) continue;
			sources.push({ path: rel, source: readTextFileSync(abs) });
		}
	}
	return sources;
}

function main(): void {
	const sources = gatherSources();
	const result = evaluateLooseZod({ sources });
	for (const f of result.findings) {
		writeStdoutLine(`${f.path}:${f.line}: ${f.token}… — ${f.excerpt}`);
	}
	writeStdoutLine(result.summary);
	if (result.findings.length === 0) {
		writeStdoutLine("no-loose-zod: PASS");
		exit(0);
	}
	writeStdoutLine("no-loose-zod: FAIL");
	exit(1);
}

if (import.meta.main) {
	main();
}
