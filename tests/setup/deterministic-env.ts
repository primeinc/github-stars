// Deterministic environment seeds for tests. Loaded by bunfig.toml's
// [test] preload list BEFORE any test file imports a module, so env
// vars consulted at module-load time read the test-frozen values.
//
// Per westcore-x1 doctrine:
//   OTel pipeline DISABLED in tests (OTEL_SDK_DISABLED=true) — the SDK
//   skips wire registration entirely, so test runs don't try to reach
//   an OTLP collector that isn't there. The OTel SDK reads this env
//   var natively per the OpenTelemetry spec; no shim required.
//
// Use ??= so individual integration tests can override (e.g. an OTel
// integration test that spawns its own collector).

Bun.env["OTEL_SDK_DISABLED"] ??= "true";

// pino log level: trace surfaces every level for tests that exercise
// log emission. Production default is "info"; trace would silently
// drop trace/debug records there.
Bun.env["LOG_LEVEL"] ??= "trace";

// Frozen GitHub Actions context. Tests that read these env vars
// (e.g. setup-doctor.ts reading GITHUB_OUTPUT / GITHUB_STEP_SUMMARY)
// see deterministic absent state — they must handle the empty case
// the same way they would in a non-Actions runtime.
Bun.env["GITHUB_RUN_ID"] ??= "test-run-0000000000";
Bun.env["GITHUB_RUN_ATTEMPT"] ??= "1";

export {};
