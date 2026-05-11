// Public surface of the telemetry kernel. Every consumer outside
// src/telemetry/** imports from this barrel — never reaches into
// `./register.js`, `./logger.js`, or the OpenTelemetry / pino packages
// directly. The eslint `no-restricted-imports` rule + dependency-cruiser
// `forbid-cross-boundary-telemetry` rule enforce that boundary.
//
// Doctrine: OTel is OBSERVABILITY ONLY. No auth signal, no secret
// material, no bearer tokens at any callsite — when in doubt, route
// through {@link scrubAttribute}.

export { createLogger } from "./logger.js";
export { PINO_REDACT_CENSOR, PINO_REDACT_PATHS } from "./redact-paths.js";
export type { RegisterTelemetryOptions } from "./register.js";
export { registerTelemetry, shutdownTelemetry } from "./register.js";
export { scrubAttribute } from "./scrub.js";
