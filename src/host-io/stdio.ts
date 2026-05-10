// Byte-level stdout / stderr writers. CLI entry points and the
// telemetry layer use these for wire-format output that must NOT be
// reshaped by the structured logger.
//
// Doctrine source: ../../../juv2/packages/host-io/src/stdio.ts.

import process from "node:process";

/**
 * Write raw bytes to stdout (no newline appended).
 *
 * @public
 */
export function writeStdout(bytes: string): void {
	process.stdout.write(bytes);
}

/**
 * Write `line` followed by `\n` to stdout.
 *
 * @public
 */
export function writeStdoutLine(line: string): void {
	process.stdout.write(`${line}\n`);
}

/**
 * Write raw bytes to stderr (no newline appended).
 *
 * @public
 */
export function writeStderr(bytes: string): void {
	process.stderr.write(bytes);
}

/**
 * Write `line` followed by `\n` to stderr.
 *
 * @public
 */
export function writeStderrLine(line: string): void {
	process.stderr.write(`${line}\n`);
}

/**
 * True iff stdout is a TTY.
 *
 * @public
 */
export function stdoutIsTTY(): boolean {
	return Boolean(process.stdout.isTTY);
}

/**
 * True iff stderr is a TTY.
 *
 * @public
 */
export function stderrIsTTY(): boolean {
	return Boolean(process.stderr.isTTY);
}
