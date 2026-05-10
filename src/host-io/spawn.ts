// Subprocess wrappers. host-io owns the boundary to node:child_process
// so the rest of the repo doesn't import it directly. Used by
// src/gate/cli.ts for the per-stage subprocess invocations.
//
// Doctrine source: ../../../juv2/packages/host-io/src/spawn.ts.

import {
	spawnSync as nodeSpawnSync,
	type SpawnSyncReturns,
} from "node:child_process";

/**
 * Options for {@link runCommandSync}.
 *
 * @public
 */
export interface RunCommandSyncOptions {
	/** Inherit the parent's stdio (true by default). */
	readonly inheritStdio?: boolean;
	/** Pass through `shell: true` so Windows `.cmd` shims resolve via PATH. */
	readonly shell?: boolean;
	/** Working directory for the subprocess. Defaults to the parent's cwd. */
	readonly cwd?: string;
}

/**
 * Result of a sync subprocess invocation.
 *
 * @public
 */
export interface RunCommandSyncResult {
	/** The exit code, or null if killed by signal. */
	readonly status: number | null;
	/** Whether the subprocess exited with status 0. */
	readonly ok: boolean;
}

/**
 * Run a subprocess synchronously. Used by the gate runner to invoke
 * each stage as its own process.
 *
 * @remarks
 * `shell: true` is the default because Windows-shimmed binaries
 * (`.cmd`, `.bat`) require PATH resolution that `shell: false` skips.
 *
 * @public
 */
export function runCommandSync(
	command: string,
	args: readonly string[] = [],
	options: RunCommandSyncOptions = {},
): RunCommandSyncResult {
	const r: SpawnSyncReturns<Buffer> = nodeSpawnSync(command, [...args], {
		stdio: options.inheritStdio === false ? "pipe" : "inherit",
		shell: options.shell ?? true,
		...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
	});
	return {
		status: r.status,
		ok: r.status === 0,
	};
}
