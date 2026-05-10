// Env-key registry. Every env var the github-stars kernel reads is named
// here exactly once. Producers (declaration sites) and consumers
// (Bun.env reads) import the same constant — no second-source-of-truth
// string anywhere in src/**.
//
// Doctrine source: ../../../../juv2/packages/catalog/src/env.ts (shape).

import * as z from "zod";
import { registerSchemaById } from "./registry.js";

/**
 * Source-of-truth tuple for every env var the github-stars kernel
 * recognises. Drives both {@link GhStarsEnvKeySchema} (runtime
 * validator) and {@link GhStarsEnv} (dot-access dictionary).
 *
 * @public
 */
export const GH_STARS_ENV_KEYS = [
  // Auth-mode resolver inputs (src/auth/setup-doctor.ts)
  "AUTH_MODE_REQUEST",
  "STAR_SOURCE_USER",
  "GH_APP_CLIENT_ID",
  "GH_APP_PRIVATE_KEY",
  "STARS_TOKEN",
  "GITHUB_TOKEN",
  "PAT_FALLBACK_TO_GITHUB_TOKEN",
  "GITHUB_APP_SUPPORTS_FETCH",
  // GitHub Actions runtime context
  "GITHUB_OUTPUT",
  "GITHUB_STEP_SUMMARY",
  "GITHUB_RUN_ID",
  "GITHUB_RUN_ATTEMPT",
  "GITHUB_REPOSITORY",
  // Telemetry
  "LOG_LEVEL",
  "OTEL_SDK_DISABLED",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_EXPORTER_OTLP_HEADERS",
  "OTEL_SERVICE_NAME",
  "OTEL_RESOURCE_ATTRIBUTES",
  // Node / dev
  "NODE_ENV",
] as const;

/**
 * Zod runtime validator: parses a string as one of the known env-key
 * literals; rejects everything else.
 *
 * @public
 */
export const GhStarsEnvKeySchema = registerSchemaById(
  z.enum(GH_STARS_ENV_KEYS),
  {
    id: "contract.github-stars.env.key.v1",
    title: "github-stars Env Key",
    description:
      "Literal-union of every env var name the kernel reads. Catches typos at compile time and gates the env catalog from drifting.",
    owner: "src/contracts/env.ts",
    version: "1.0.0",
    stability: "p1",
  },
);

/**
 * Inferred TS literal-union of every recognised env-var name.
 *
 * @public
 */
export type GhStarsEnvKey = z.infer<typeof GhStarsEnvKeySchema>;

/**
 * Dot-access dictionary of env-var literals. Mirrors
 * {@link GH_STARS_ENV_KEYS} but indexed by intent-revealing keys; the
 * `satisfies` clause guarantees compile-time parity with the schema's
 * literal set — a missing or extra entry fails TS at this file.
 *
 * @public
 */
export const GhStarsEnv = {
  authModeRequest: "AUTH_MODE_REQUEST",
  starSourceUser: "STAR_SOURCE_USER",
  ghAppClientId: "GH_APP_CLIENT_ID",
  ghAppPrivateKey: "GH_APP_PRIVATE_KEY",
  starsToken: "STARS_TOKEN",
  githubToken: "GITHUB_TOKEN",
  patFallbackToGithubToken: "PAT_FALLBACK_TO_GITHUB_TOKEN",
  githubAppSupportsFetch: "GITHUB_APP_SUPPORTS_FETCH",
  githubOutput: "GITHUB_OUTPUT",
  githubStepSummary: "GITHUB_STEP_SUMMARY",
  githubRunId: "GITHUB_RUN_ID",
  githubRunAttempt: "GITHUB_RUN_ATTEMPT",
  githubRepository: "GITHUB_REPOSITORY",
  logLevel: "LOG_LEVEL",
  otelSdkDisabled: "OTEL_SDK_DISABLED",
  otelExporterOtlpEndpoint: "OTEL_EXPORTER_OTLP_ENDPOINT",
  otelExporterOtlpHeaders: "OTEL_EXPORTER_OTLP_HEADERS",
  otelServiceName: "OTEL_SERVICE_NAME",
  otelResourceAttributes: "OTEL_RESOURCE_ATTRIBUTES",
  nodeEnv: "NODE_ENV",
} as const satisfies Record<string, GhStarsEnvKey>;
