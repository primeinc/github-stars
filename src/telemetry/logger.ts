// Pino logger factory. Single entry point for log emission across the
// kernel; everything outside src/telemetry/** routes through
// `createLogger(scope)` and the per-scope logger's standard
// `{trace,debug,info,warn,error,fatal}` methods.
//
// The logger applies the redact path catalog from `./redact-paths.ts`
// so secret-shaped fields are censored before serialisation. Log level
// follows the standard `LOG_LEVEL` env var (per
// `src/contracts/env.ts` registration); default is `info`.
//
// Doctrine: log lines are observability, not auth signal. Never branch
// authorisation on the presence/absence of a log line.

import { type Logger, pino } from "pino";
import { getEnv } from "../host-io/index.js";
import { PINO_REDACT_CENSOR, PINO_REDACT_PATHS } from "./redact-paths.js";

let rootLogger: Logger | undefined;

/**
 * Lazily build the singleton root pino logger. Subsequent calls return
 * the same instance; the redact paths and base level are fixed for the
 * life of the process.
 *
 * @internal
 */
function getRootLogger(): Logger {
	if (rootLogger !== undefined) return rootLogger;
	const level = getEnv("LOG_LEVEL") ?? "info";
	rootLogger = pino({
		level,
		redact: {
			paths: [...PINO_REDACT_PATHS],
			censor: PINO_REDACT_CENSOR,
		},
	});
	return rootLogger;
}

/**
 * Returns a child logger bound to the given scope (typically the
 * subsystem name, e.g. `"fetch"`, `"sync"`, `"auth"`). Scope appears
 * as the `scope` field on every emitted line so backends can route by
 * subsystem.
 *
 * Calling this before `registerTelemetry` (in `./register.js`) is
 * safe — the logger works without OTel, and the OTel transport
 * (when wired) is layered on at telemetry registration time.
 *
 * @public
 */
export function createLogger(scope: string): Logger {
	return getRootLogger().child({ scope });
}
