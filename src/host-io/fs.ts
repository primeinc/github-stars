// Sync filesystem surface. host-io owns the SYNC fs primitives for this
// repo. For small local-disk reads / writes / existence checks, sync via
// `node:fs` is the canonical primitive — deterministic, no event-loop
// trip, no cold-start surface under CI contention.
//
// Atomic write (writeTextFileAtomicSync) wraps `write-file-atomic` so the
// library owns the temp-file naming, write, fsync, rename, and crash
// cleanup — a previous run that died mid-write does not leave a
// half-written `<path>` behind. Closes the CodeQL js/file-system-race
// (TOCTOU) class structurally: there is no existsSync precheck because
// the open() inside write-file-atomic IS authoritative.
//
// Doctrine source: ../../../juv2/packages/host-io/src/fs.ts (slim port).

import {
	appendFileSync as nodeAppendFileSync,
	cpSync as nodeCpSync,
	existsSync as nodeExistsSync,
	mkdirSync as nodeMkdirSync,
	mkdtempSync as nodeMkdtempSync,
	readdirSync as nodeReaddirSync,
	readFileSync as nodeReadFileSync,
	renameSync as nodeRenameSync,
	rmSync as nodeRmSync,
	statSync as nodeStatSync,
	writeFileSync as nodeWriteFileSync,
	type Stats,
} from "node:fs";
import { appendFile as nodeAppendFile } from "node:fs/promises";
import { tmpdir as nodeTmpdir } from "node:os";
import { lockSync as properLockSync } from "proper-lockfile";
import writeFileAtomicLib from "write-file-atomic";

import { joinPaths } from "./path.js";

/**
 * Sync read of a UTF-8 text file. Canonical primitive for small
 * local-disk reads.
 *
 * @public
 */
export function readTextFileSync(path: string): string {
	return nodeReadFileSync(path, "utf8");
}

/**
 * Sync read of a binary file as a `Uint8Array`. Use for hashing,
 * checksumming, or any byte-level work.
 *
 * @public
 */
export function readFileBytesSync(path: string): Uint8Array {
	return nodeReadFileSync(path);
}

/**
 * Sync write of a UTF-8 text file. Overwrites.
 *
 * @public
 */
export function writeTextFileSync(path: string, content: string): void {
	nodeWriteFileSync(path, content, "utf8");
}

/**
 * Atomically write a UTF-8 text file. Wraps `write-file-atomic` so the
 * library owns the temp-file naming, write, fsync, rename, and crash
 * cleanup — a previous run that died mid-write does not leave a
 * half-written `<path>` behind. The caller sees the new content or the
 * old content, never a torn state.
 *
 * @remarks
 * Throws on any underlying I/O failure; the temp file is cleaned up
 * before the throw propagates.
 *
 * Use for writes that must survive process death without corrupting
 * the target. For day-to-day overwrites where torn-write recovery is
 * not required, prefer {@link writeTextFileSync}.
 *
 * @public
 */
export function writeTextFileAtomicSync(path: string, content: string): void {
	writeFileAtomicLib.sync(path, content, "utf8");
}

/**
 * Acquire an inter-process advisory lock on `path` and return a sync
 * release callback. Wraps `proper-lockfile`'s `lockSync`, which uses
 * directory-creation (`<path>.lock/`) as the cross-platform mutex
 * primitive — atomic on POSIX `mkdir` and Win32 `CreateDirectory`.
 *
 * `realpath: false` is set so `path` does not have to exist before the
 * call.
 *
 * @public
 */
export function acquireFileLockSync(path: string): () => void {
	return properLockSync(path, { realpath: false });
}

/**
 * Sync existence check (file or directory).
 *
 * @public
 */
export function pathExistsSync(path: string): boolean {
	return nodeExistsSync(path);
}

/**
 * Create a directory. Recursive by default. Sync.
 *
 * @public
 */
export function makeDirSync(
	path: string,
	options: { recursive?: boolean } = {},
): void {
	nodeMkdirSync(path, { recursive: options.recursive ?? true });
}

/**
 * Sync remove of a file or directory tree. Recursive + force by default.
 *
 * @public
 */
export function removePathSync(
	path: string,
	options: { recursive?: boolean; force?: boolean } = {},
): void {
	nodeRmSync(path, {
		recursive: options.recursive ?? true,
		force: options.force ?? true,
	});
}

/**
 * Sync rename of a file or directory.
 *
 * @public
 */
export function renameSync(oldPath: string, newPath: string): void {
	nodeRenameSync(oldPath, newPath);
}

/**
 * Sync copy of a file or directory tree. Recursive + force by default.
 *
 * @public
 */
export function copyPathSync(
	src: string,
	dest: string,
	options: { recursive?: boolean; force?: boolean } = {},
): void {
	nodeCpSync(src, dest, {
		recursive: options.recursive ?? true,
		force: options.force ?? true,
	});
}

/**
 * Create a unique temp directory under the OS tmpdir. Returns the
 * absolute path.
 *
 * @public
 */
export function makeTempDirSync(prefix: string): string {
	return nodeMkdtempSync(joinPaths(nodeTmpdir(), prefix));
}

/**
 * Append text to a file (async). Caller must create parent directories
 * explicitly via {@link makeDirSync}.
 *
 * @public
 */
export async function appendFileText(
	filePath: string,
	text: string,
): Promise<void> {
	await nodeAppendFile(filePath, text, "utf8");
}

/**
 * Append text to a file (sync). Required by GITHUB_OUTPUT writers in
 * setup-doctor and CLI entry points.
 *
 * @public
 */
export function appendFileTextSync(filePath: string, text: string): void {
	nodeAppendFileSync(filePath, text, "utf8");
}

/**
 * List directory entries (sync). Returns filenames only (not full
 * paths). Throws on missing directory.
 *
 * @public
 */
export function listDirSync(path: string): string[] {
	return nodeReaddirSync(path);
}

/**
 * Stat a path (sync). Throws on missing path.
 *
 * @public
 */
export function statPathSync(path: string): Stats {
	return nodeStatSync(path);
}

/**
 * File size in bytes. Throws on missing path.
 *
 * @public
 */
export function fileSizeBytesSync(path: string): number {
	return nodeStatSync(path).size;
}

/**
 * Optional predicates for {@link walkFilesSync}.
 *
 * @public
 */
export interface WalkFilesOptions {
	/**
	 * Predicate called per directory before descending. Returning true
	 * skips the directory (and its entire subtree).
	 */
	readonly skipDir?: (entry: {
		readonly name: string;
		readonly absPath: string;
	}) => boolean;
	/**
	 * Predicate called per regular file. Returning true includes the
	 * file in the result; false skips it.
	 */
	readonly includeFile?: (entry: {
		readonly name: string;
		readonly absPath: string;
	}) => boolean;
}

/**
 * Recursive sync directory walk. Returns absolute paths to every
 * regular file under `startDir` that passes the optional predicates.
 *
 * @remarks
 * Wraps node:fs.readdirSync + statSync so callers don't import
 * node:fs directly. Depth-first; failures to read a child throw
 * immediately rather than silently skipping (a missing directory is
 * a config-drift bug, not a fall-through condition). Used by the
 * gate runner (src/gate/no-loose-zod-cli.ts) to enumerate src/**.
 *
 * @public
 */
export function walkFilesSync(
	startDir: string,
	options: WalkFilesOptions = {},
): string[] {
	const out: string[] = [];
	function visit(dir: string): void {
		for (const name of nodeReaddirSync(dir)) {
			const absPath = joinPaths(dir, name);
			const st = nodeStatSync(absPath);
			if (st.isDirectory()) {
				if (options.skipDir?.({ name, absPath })) continue;
				visit(absPath);
				continue;
			}
			if (!st.isFile()) continue;
			if (options.includeFile && !options.includeFile({ name, absPath })) {
				continue;
			}
			out.push(absPath);
		}
	}
	visit(startDir);
	return out;
}
