// node:path wrappers. host-io owns the path primitives so the rest of
// the repo doesn't import node:path directly.
//
// Doctrine source: ../../../juv2/packages/host-io/src/path.ts.

import {
	basename as nodeBasename,
	dirname as nodeDirname,
	extname as nodeExtname,
	isAbsolute as nodeIsAbsolute,
	join as nodeJoin,
	normalize as nodeNormalize,
	relative as nodeRelative,
	resolve as nodeResolve,
	sep as nodeSep,
} from "node:path";

/**
 * Join path segments using the platform separator.
 *
 * @public
 */
export function joinPaths(...segments: string[]): string {
	return nodeJoin(...segments);
}

/**
 * Resolve to an absolute path.
 *
 * @public
 */
export function resolvePath(...segments: string[]): string {
	return nodeResolve(...segments);
}

/**
 * Compute the relative path from `from` to `to`.
 *
 * @public
 */
export function relativePath(from: string, to: string): string {
	return nodeRelative(from, to);
}

/**
 * Return the directory name of a path.
 *
 * @public
 */
export function dirnameOf(path: string): string {
	return nodeDirname(path);
}

/**
 * Return the basename of a path (optionally stripping `ext`).
 *
 * @public
 */
export function basenameOf(path: string, ext?: string): string {
	return ext === undefined ? nodeBasename(path) : nodeBasename(path, ext);
}

/**
 * Return the extension of a path (including the leading dot, or "").
 *
 * @public
 */
export function extnameOf(path: string): string {
	return nodeExtname(path);
}

/**
 * Normalize a path (collapses `..`, doubled separators, etc.).
 *
 * @public
 */
export function normalizePath(path: string): string {
	return nodeNormalize(path);
}

/**
 * True if `path` is absolute on the current platform.
 *
 * @public
 */
export function isAbsolutePath(path: string): boolean {
	return nodeIsAbsolute(path);
}

/**
 * Platform path separator (`/` on POSIX, `\\` on Windows).
 *
 * @public
 */
export const pathSep: string = nodeSep;
