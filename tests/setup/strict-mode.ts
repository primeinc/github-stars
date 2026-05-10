// Strict-mode preload. Loud-fail unhandled errors, freeze time. Never
// touches stdio.
//
// Doctrine:
//   refs/oven-sh/bun/docs/test/runtime-behavior.mdx:86-145 — Bun fails
//     the run on unhandled rejection / uncaught exception. We re-amplify
//     with a thrown error so the failure surfaces with a stack trace.
//   refs/oven-sh/bun/docs/test/dates-times.mdx:16-30 — setSystemTime in
//     beforeAll freezes Date.now() / new Date() / Intl.DateTimeFormat()
//     for every test in the file. UTC default per line 102.
//   refs/oven-sh/bun/docs/test/lifecycle.mdx:111-145 — preload runs
//     once before all tests; canonical home for global setup.
//
// setSystemTime does NOT auto-reset between tests. Seed once in
// beforeAll; tests that mutate the clock are responsible for restore.

import { beforeAll, setSystemTime } from "bun:test";

export const FROZEN_INSTANT = new Date("2026-01-01T00:00:00.000Z");

/**
 * Builds the loud-fail message for an unhandled promise rejection.
 * Pure — used by the process-level handler in this preload. Exposed
 * for unit-testing the message shape.
 *
 * @public
 */
export function buildUnhandledRejectionMessage(reason: unknown): string {
  const tail = reason instanceof Error ? reason.stack : String(reason);
  return `Unhandled rejection during tests: ${tail}`;
}

/**
 * Builds the loud-fail message for an uncaught synchronous exception.
 * Pure — used by the process-level handler in this preload. Exposed
 * for unit-testing the message shape.
 *
 * @public
 */
export function buildUncaughtExceptionMessage(error: Error): string {
  const tail = error.stack ?? error.message;
  return `Uncaught exception during tests: ${tail}`;
}

beforeAll(() => {
  setSystemTime(FROZEN_INSTANT);
});

process.on("unhandledRejection", (reason) => {
  throw new Error(buildUnhandledRejectionMessage(reason));
});

process.on("uncaughtException", (error) => {
  throw new Error(buildUncaughtExceptionMessage(error));
});
