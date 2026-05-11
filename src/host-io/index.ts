// `src/host-io` — host-boundary primitives for stdio, process lifecycle,
// sync filesystem, paths, and child-spawn. Every direct `node:fs`,
// `node:fs/promises`, `node:os`, `node:path`, `node:child_process`, and
// `node:process` access in this repo routes through this package; the
// eslint `no-restricted-imports` rule + dependency-cruiser's
// `no-non-package-json` rule enforce that boundary.
//
// Doctrine source: ../../../juv2/packages/host-io/src/index.ts.

export type { WalkFilesOptions } from "./fs.js";
export {
	acquireFileLockSync,
	appendFileText,
	appendFileTextSync,
	copyPathSync,
	fileSizeBytesSync,
	listDirSync,
	makeDirSync,
	makeTempDirSync,
	pathExistsSync,
	readFileBytesSync,
	readTextFileSync,
	removePathSync,
	renameSync,
	statPathSync,
	walkFilesSync,
	writeTextFileAtomicSync,
	writeTextFileSync,
} from "./fs.js";
export {
	basenameOf,
	dirnameOf,
	extnameOf,
	isAbsolutePath,
	joinPaths,
	normalizePath,
	pathSep,
	relativePath,
	resolvePath,
} from "./path.js";
export {
	chdir,
	currentPid,
	cwd,
	exit,
	getEnv,
	onSignal,
	platform,
	processArgv,
	setExitCode,
} from "./process.js";
export type { RunCommandSyncOptions, RunCommandSyncResult } from "./spawn.js";
export { runCommandSync } from "./spawn.js";
export {
	stderrIsTTY,
	stdoutIsTTY,
	writeStderr,
	writeStderrLine,
	writeStdout,
	writeStdoutLine,
} from "./stdio.js";
