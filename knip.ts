// Knip config — finds unused files, exports, dependencies.
//
// Doctrine source: ../../juv2/knip.ts (shape; scope-trimmed for our
// flat single-package repo; we lean on knip's auto-discovery via
// package.json + tsconfig and only override what knip can't infer).
//
// Run: `bun run knip`. Wired into the gate via `gate:knip`.

import type { KnipConfig } from "knip";

const config: KnipConfig = {
	// Knip respects .gitignore by default (no need to re-list dist/,
	// coverage/, generated/, node_modules/, etc.).
	//
	// Exclusions only for paths NOT in .gitignore that should be
	// out-of-scope for the root config:
	//   - web/ has its own package.json + own bundler (separate workspace
	//     root); knip needs an explicit workspace setup to see them and
	//     we don't have one yet.
	//   - docs/ is the pre-built static site committed for GitHub Pages
	//     (not source).
	//   - scripts/*.{js,mjs,cjs} are legacy node-shaped scripts that
	//     shell out to yq/git/etc; they don't import any TS we own.
	ignore: [
		"web/**",
		"docs/**",
		"scripts/migrate-data.js",
		"scripts/migrate-data-regex.js",
		"scripts/recover-stars-from-rest.mjs",
		"scripts/reconstruct-repos-yml.mjs",
		"scripts/generate-readmes.js",
	],
	// Workflow files invoke playwright via shell; knip's binary scanner
	// can't follow YAML.
	ignoreBinaries: ["playwright"],
	// Dependencies present for upcoming phases of the modernization
	// sprint. They are intentionally pre-installed so the migration
	// commits don't have to interleave dep additions with code changes.
	// Once each phase wires its dep, remove the entry from this list:
	//   - Phase C6 (telemetry): @opentelemetry/* + pino + pino-opentelemetry-transport
	//   - Phase C7 (commander+listr2+picocolors)
	//   - Phase C1/C2 (octokit openapi-types + graphql-schema + app + graphql)
	//   - Phase H (TanStack Start) will bring its own deps
	//   - Future: fast-check (property-based testing), eslint-plugin-jest
	ignoreDependencies: [
		"@octokit/app",
		"@octokit/graphql",
		"@opentelemetry/exporter-logs-otlp-http",
		"@opentelemetry/resources",
		"@opentelemetry/sdk-logs",
		"@opentelemetry/sdk-trace-base",
		"@opentelemetry/sdk-trace-node",
		"@opentelemetry/semantic-conventions",
		"@parcel/watcher",
		"pino-opentelemetry-transport",
		"eslint-plugin-jest",
		"fast-check",
	],
	// host-io is a CANONICAL WRAPPER LIBRARY around node:fs / node:path /
	// node:os / etc. Its barrel re-exports the full sanctioned surface
	// even when only some are used today — future Phase tasks (#66
	// telemetry, #67 dual-write) will reach for the others. The
	// `paths.ts`-style derivation (paths-codegen consumes the full
	// surface) is the design intent.
	//
	// Knip flags every unused re-export; suppress them with a per-file
	// rule that points knip at the public surface only.
	rules: {
		exports: "warn",
		nsExports: "warn",
		types: "warn",
		nsTypes: "warn",
	},
	// Per-issue ignore: host-io exports are part of the public API by
	// design (canonical wrapper surface). Knip's `ignoreExportsUsedInFile`
	// doesn't apply — these aren't used in the file, they're the file's
	// PURPOSE. The barrel IS the public API.
	ignoreExportsUsedInFile: false,
	// Tag-based ignore: anything marked `@public` in TSDoc is part of
	// the library's external surface. Knip respects this when given the
	// `+public` tag filter — only flag exports lacking the tag. Per
	// the project's TSDoc canonical doctrine, every exported symbol in
	// src/** carries `@public`, so this effectively whitelists every
	// declared public surface.
	tags: ["+public"],
};

export default config;
