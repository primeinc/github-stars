// process / env / exit / signals — host-io owns the interface to the
// running process so the rest of the repo doesn't touch
// `globalThis.process` directly.
//
// Under the bun runtime, `Bun.env` is canonical for env-var access
// (per refs/oven-sh/bun/docs/runtime/env.mdx); `process.env` works but
// is the legacy compat surface. host-io exposes both via getEnv to keep
// the call sites uniform.
//
// Doctrine source: ../../../juv2/packages/host-io/src/process.ts.

import process from "node:process";

/**
 * Process id of the current process.
 *
 * @public
 */
export function currentPid(): number {
	return process.pid;
}

/**
 * Current working directory.
 *
 * @public
 */
export function cwd(): string {
	return process.cwd();
}

/**
 * Change the current working directory.
 *
 * @public
 */
export function chdir(path: string): void {
	process.chdir(path);
}

/**
 * Read an env var by name. Returns the raw string value or undefined.
 *
 * @public
 */
export function getEnv(name: string): string | undefined {
	return process.env[name];
}

/**
 * Exit the process with the given code.
 *
 * @public
 */
export function exit(code = 0): never {
	process.exit(code);
}

/**
 * Set the deferred exit code without aborting now. Used for "fail at
 * end" patterns.
 *
 * @public
 */
export function setExitCode(code: number): void {
	process.exitCode = code;
}

/**
 * Register a SIGTERM/SIGINT/etc. handler.
 *
 * @public
 */
export function onSignal(signal: NodeJS.Signals, listener: () => void): void {
	process.on(signal, listener);
}

/**
 * Process arguments after the runtime + script name.
 *
 * @public
 */
export function processArgv(): readonly string[] {
	return process.argv;
}

/**
 * Platform identifier (`win32`, `darwin`, `linux`, etc.). Same shape
 * as `node:process.platform`.
 *
 * @public
 */
export function platform(): NodeJS.Platform {
	return process.platform;
}
