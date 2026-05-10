// OpenTelemetry NodeSDK bootstrap. Port of westcore-x1's
// `OpenTelemetryRegistration.AddX1XpressOpenTelemetry` (the C# 1:1
// reference at
// `../../westcore-x1/templates/dotnet-endpoint-agent/src/X1Xpress.Agent.Shared/Telemetry/OpenTelemetryRegistration.cs`).
//
// Init contract:
//   - call `registerTelemetry({ serviceName })` ONCE, as early as
//     possible in the process (before any auto-instrumented module is
//     imported);
//   - the SDK reads standard OTEL_* env vars
//     (OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS,
//     OTEL_SERVICE_NAME, OTEL_RESOURCE_ATTRIBUTES, OTEL_SDK_DISABLED)
//     directly per refs/open-telemetry/opentelemetry-js/experimental/
//     packages/opentelemetry-sdk-node/README.md;
//   - when OTEL_EXPORTER_OTLP_ENDPOINT is unset, the SDK is NOT
//     started — the kernel runs without OTel exporters and pays no
//     connection-refused cost on dev machines without a collector
//     (matches westcore's `HasConfiguredEndpoint` gate).
//
// Doctrine: telemetry is OBSERVABILITY ONLY. Never branch
// authorisation, retry behaviour, or cache writes on whether OTel is
// active.

import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { GhStarsEnv } from "../contracts/env.js";
import { getEnv } from "../host-io/index.js";

let sdk: NodeSDK | undefined;
let started = false;

/**
 * Options bag for {@link registerTelemetry}. `serviceName` is the
 * `service.name` resource attribute used by backends to join spans /
 * logs / metrics from one component.
 *
 * @public
 */
export interface RegisterTelemetryOptions {
	readonly serviceName: string;
}

/**
 * True when the operator has configured an OTLP collector endpoint
 * via the standard `OTEL_EXPORTER_OTLP_ENDPOINT` env var. When false,
 * `registerTelemetry` skips SDK start entirely.
 *
 * @internal
 */
function hasConfiguredEndpoint(): boolean {
	const endpoint = getEnv(GhStarsEnv.otelExporterOtlpEndpoint);
	return endpoint !== undefined && endpoint.trim() !== "";
}

/**
 * Bootstrap OpenTelemetry tracing, metrics, and logs for the current
 * process. Idempotent: subsequent calls after the first are no-ops.
 *
 * Returns `true` when the SDK was started (an OTLP endpoint is
 * configured), `false` when registration was skipped (no endpoint).
 *
 * @public
 */
export function registerTelemetry(options: RegisterTelemetryOptions): boolean {
	if (started) return sdk !== undefined;
	started = true;

	if (getEnv(GhStarsEnv.otelSdkDisabled)?.toLowerCase() === "true") {
		return false;
	}
	if (!hasConfiguredEndpoint()) {
		return false;
	}

	sdk = new NodeSDK({
		serviceName: options.serviceName,
		traceExporter: new OTLPTraceExporter(),
		metricReader: new PeriodicExportingMetricReader({
			exporter: new OTLPMetricExporter(),
		}),
		instrumentations: [new HttpInstrumentation(), new UndiciInstrumentation()],
	});

	sdk.start();
	return true;
}

/**
 * Gracefully shut down the OpenTelemetry pipeline (flushes pending
 * spans, metrics, logs). Safe to call when the SDK was never started.
 * Intended for SIGTERM/SIGINT handlers.
 *
 * @public
 */
export async function shutdownTelemetry(): Promise<void> {
	if (sdk === undefined) return;
	await sdk.shutdown();
	sdk = undefined;
	started = false;
}
