// Flat ESLint config — typed TypeScript linting + Bun-native runtime
// boundary. Loaded by ESLint via jiti (devDependency).
//
// First-party references:
//   - https://typescript-eslint.io/getting-started
//   - https://eslint.org/docs/latest/rules/no-restricted-imports
//   - https://github.com/eslint-community/eslint-plugin-n
//
// Doctrine source: ../../juv2/eslint.config.ts (shape; scope-trimmed for
// our flat single-package repo + smaller plugin set).
//
// Repo-wide invariants enforced here:
//
//   1. node:fs / node:fs/promises / node:os / node:path / node:crypto /
//      node:child_process / node:util / node:zlib / node:readline /
//      node:stream / node:stream/promises / node:url{pathToFileURL}
//      may ONLY be imported by `src/host-io/**`.
//
//      Defense in depth: this rule + dependency-cruiser's no-non-package-json
//      rule + the host-io public barrel re-exports. Three layers because
//      no-restricted-imports doesn't see CommonJS `require()` and depcruise
//      doesn't see TS-typed import resolution; both gates need to fire.
//
//   2. pino / @opentelemetry/* may ONLY be imported by `src/telemetry/**`.
//      App code uses `createLogger(scope) + log.{level}(...)` per the
//      telemetry doctrine memory.
//
//   3. ajv / ajv-formats are BANNED — Zod replaces them as the runtime
//      contract (catches accidental re-introduction of ajv's fast-uri
//      vuln chain). @exodus/schemasafe (zero-dep JSON-Schema validator)
//      is allowed for repos.yml boundary checks against the JSON schema
//      derived from the Zod source of truth.
//
//   4. Public-API surfaces in `src/**` (exported types/functions/classes)
//      require TSDoc with `@public`/`@internal` discrimination, per the
//      jsdoc/tsdoc rules below.

import { type Config, defineConfig } from "eslint/config";
import jsdoc from "eslint-plugin-jsdoc";
import nodePlugin from "eslint-plugin-n";
// eslint-plugin-security ships JS only; types live in DefinitelyTyped
// per the canonical README L88-95
// (refs/eslint-community/eslint-plugin-security/README.md):
//
//   "Type definitions for this package are managed by DefinitelyTyped.
//    Use @types/eslint-plugin-security for type checking."
//
// HOWEVER: the DefinitelyTyped package (@types/eslint-plugin-security
// @3.0.1) depends on @types/eslint@*, which currently resolves to
// 9.6.1 — pre-eslint-10 — and that version's `Linter.LanguageOptions`
// shape conflicts with @eslint/core's newer LanguageOptions used by
// our defineConfig import from eslint/config. Until the @types
// package catches up to eslint 10, we silence TS7016 once at the
// import site and cast the runtime value to a minimal shape so the
// rest of this file stays `any`-free.
// @ts-expect-error TS7016: @types/eslint-plugin-security pulls a stale
// @types/eslint that conflicts with eslint v10 / @eslint/core LanguageOptions.
import securityPluginUntyped from "eslint-plugin-security";

const securityPlugin = securityPluginUntyped as unknown as {
	configs: { recommended: Config };
};

import tsdocPlugin from "eslint-plugin-tsdoc";
import zodPlugin from "eslint-plugin-zod";
import tseslint from "typescript-eslint";

/**
 * Repo-wide restricted-import entries. Apply EVERYWHERE with no
 * carve-out except per-file-overrides further down.
 *
 * Sources (banned absolutely / quarantined to a single owner):
 *   - node:fs / node:fs/promises / node:os / node:path / node:crypto /
 *     node:child_process / node:util / node:zlib / node:readline /
 *     node:stream / node:stream/promises and unprefixed forms — quarantined
 *     to src/host-io/src/**.
 *   - node:url { pathToFileURL } — banned everywhere; use Bun.pathToFileURL.
 *   - pino / pino-opentelemetry-transport / @opentelemetry/* — quarantined
 *     to src/telemetry/**.
 *   - ajv / ajv-formats — banned absolutely; use Zod (Zod is the runtime
 *     contract, @exodus/schemasafe is the JSON-Schema-shape boundary
 *     check for repos.yml — zero deps, no fast-uri vuln).
 */
const REPO_WIDE_RESTRICTED_IMPORTS = [
	{
		name: "node:fs",
		message:
			"Banned outside src/host-io/. Use the host-io wrapper (readTextFileSync / writeTextFileSync / writeTextFileAtomicSync / pathExistsSync / makeDirSync / etc). If host-io lacks the surface, add it there with a TSDoc citation.",
	},
	{
		name: "fs",
		message:
			"Banned outside src/host-io/. Use the host-io wrapper (readTextFileSync / writeTextFileSync / writeTextFileAtomicSync / pathExistsSync / makeDirSync / etc).",
	},
	{
		name: "node:fs/promises",
		message:
			"Banned outside src/host-io/. Use Bun's first-party async APIs (`await Bun.file(p).text()` / `await Bun.write(p, c)`) or src/host-io's appendFileText.",
	},
	{
		name: "fs/promises",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "node:os",
		message:
			"Banned outside src/host-io/. host-io owns os.homedir / os.tmpdir / os.hostname; consumers go through the host-io re-exports.",
	},
	{
		name: "os",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "node:path",
		message:
			"Banned outside src/host-io/. host-io re-exports the sanctioned path surface.",
	},
	{
		name: "path",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "node:crypto",
		message:
			"Banned outside src/host-io/. Use crypto.randomUUID() via host-io.",
	},
	{
		name: "crypto",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "node:child_process",
		message: "Banned outside src/host-io/. Use Bun.spawn or host-io spawn.",
	},
	{
		name: "child_process",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "node:util",
		message: "Banned outside src/host-io/. Use TypeScript native equivalents.",
	},
	{
		name: "util",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "node:zlib",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "zlib",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "node:readline",
		message:
			"Banned outside src/host-io/. Use Bun.stdin or host-io stdin helpers.",
	},
	{
		name: "readline",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "node:stream",
		message: "Banned outside src/host-io/. Use Bun.file streaming or host-io.",
	},
	{
		name: "stream",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "node:stream/promises",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "stream/promises",
		message: "Banned outside src/host-io/.",
	},
	{
		name: "node:url",
		importNames: ["pathToFileURL"],
		message:
			"pathToFileURL is banned. Use Bun.pathToFileURL or pass file paths directly to Bun APIs.",
	},
	{
		name: "url",
		importNames: ["pathToFileURL"],
		message:
			"pathToFileURL is banned. Use Bun.pathToFileURL or pass file paths directly to Bun APIs.",
	},
	{
		name: "pino",
		message:
			"Banned outside src/telemetry/. Use createLogger(scope) + log.{trace,debug,info,warn,error,fatal}.",
	},
	{
		name: "pino-opentelemetry-transport",
		message:
			"Banned outside src/telemetry/ — wired internally as pino's OTLP transport.",
	},
	{
		name: "@opentelemetry/sdk-node",
		message:
			"Banned outside src/telemetry/ — wired internally as the OTel pipeline.",
	},
	{
		name: "@opentelemetry/sdk-logs",
		message: "Banned outside src/telemetry/.",
	},
	{
		name: "@opentelemetry/sdk-trace-base",
		message: "Banned outside src/telemetry/.",
	},
	{
		name: "@opentelemetry/sdk-trace-node",
		message: "Banned outside src/telemetry/.",
	},
	{
		name: "@opentelemetry/sdk-metrics",
		message: "Banned outside src/telemetry/.",
	},
	{
		name: "@opentelemetry/exporter-logs-otlp-http",
		message: "Banned outside src/telemetry/.",
	},
	{
		name: "@opentelemetry/exporter-metrics-otlp-http",
		message: "Banned outside src/telemetry/.",
	},
	{
		name: "@opentelemetry/exporter-trace-otlp-http",
		message: "Banned outside src/telemetry/.",
	},
	{
		name: "@opentelemetry/instrumentation-http",
		message: "Banned outside src/telemetry/.",
	},
	{
		name: "@opentelemetry/instrumentation-undici",
		message: "Banned outside src/telemetry/.",
	},
	{
		name: "ajv",
		message:
			"Banned. Use Zod schemas + GhStarsSchemaRegistry. ajv pulls fast-uri (currently unpatchable for the GHSA-v39h / GHSA-q3j6 advisories). For JSON-Schema-shape validation against repos.yml use @exodus/schemasafe (zero deps, no fast-uri).",
	},
	{
		name: "ajv-formats",
		message: "Banned. Use Zod schemas.",
	},
	// Replaced wholesale by @octokit/app + @octokit/rest + @octokit/openapi-types
	{
		name: "@octokit/core",
		message:
			"Banned. Use @octokit/app (auth) + @octokit/rest (calls) + @octokit/openapi-types (response types).",
	},
	{
		name: "@octokit/auth-app",
		message: "Banned. Use @octokit/app.",
	},
	{
		name: "@octokit/plugin-request-log",
		message: "Banned. @octokit/app handles request logging.",
	},
	{
		name: "@octokit/plugin-retry",
		message: "Banned. @octokit/app + retry config replaces this.",
	},
];

// Tuple shape ESLint's no-restricted-imports rule expects:
// `[severity, optionsObject]`. Without `as const` the literal arrays
// inside REPO_WIDE_RESTRICTED_IMPORTS widen to mutable string[], which
// the rule's option types accept.
const RESTRICTED_IMPORTS_OPTIONS: [
	"error",
	{ paths: typeof REPO_WIDE_RESTRICTED_IMPORTS },
] = [
	"error",
	{
		paths: REPO_WIDE_RESTRICTED_IMPORTS,
	},
];

/**
 * Sync-API ban with allowlist for the host-io sync wrapper names. Per
 * `eslint-plugin-n` `no-sync` rule docs.
 */
const NO_SYNC_OPTIONS: [
	"error",
	{ allowAtRootLevel: boolean; ignores: string[] },
] = [
	"error",
	{
		allowAtRootLevel: false,
		ignores: [
			// node:fs primitives — host-io only (the no-restricted-imports
			// rule above prevents anyone else from importing them).
			"appendFileSync",
			"mkdirSync",
			"mkdtempSync",
			"renameSync",
			"rmSync",
			"statSync",
			"readdirSync",
			"writeFileSync",
			"readFileSync",
			"existsSync",
			"cpSync",
			"watch",
			// host-io sync wrapper names — these ARE the documented sync
			// surface, banning the *Sync suffix would defeat the wrapper.
			"readTextFileSync",
			"readFileBytesSync",
			"writeTextFileSync",
			"writeTextFileAtomicSync",
			"acquireFileLockSync",
			"appendFileTextSync",
			"pathExistsSync",
			"makeDirSync",
			"makeTempDirSync",
			"removePathSync",
			"copyPathSync",
			"listDirSync",
			"statPathSync",
			"fileSizeBytesSync",
			"walkFilesSync",
			// proper-lockfile sync API
			"lockSync",
			// Bun.Glob sync iterator
			"scanSync",
			// zod-config sync loader — used by src/contracts/paths.ts to
			// load the static-imported paths config through the registered
			// schema at module init.
			"loadConfigSync",
		],
	},
];

// TSDoc Standard tag inventory — sourced 1:1 from
// `refs/microsoft/tsdoc/tsdoc/src/details/StandardTags.ts` L557-587
// (`StandardTags.allDefinitions`). These are the tags the canonical
// parser recognizes; using anything else fails `jsdoc/check-tag-names`.
//
// Classification per the spec:
//   - Core         normative; conforming tools must support
//   - Extended     normative; parsers may opt out
//   - Discretionary suggested meaning; tools interpret freely
const TSDOC_STANDARD_TAGS = [
	// Discretionary — release stage modifiers (API Extractor convention)
	"alpha",
	"beta",
	"experimental",
	"public",
	"internal",
	// Extended
	"decorator",
	"defaultValue",
	"eventProperty",
	"example",
	"inheritDoc",
	"override",
	"readonly",
	"sealed",
	"see",
	"throws",
	"virtual",
	"jsx",
	"jsxRuntime",
	"jsxFrag",
	"jsxImportSource",
	// Core
	"deprecated",
	"label",
	"link",
	"packageDocumentation",
	"param",
	"privateRemarks",
	"remarks",
	"returns",
	"typeParam",
];

/**
 * Flat ESLint configuration. Order matters — later blocks override
 * earlier ones (per ESLint flat-config semantics).
 *
 * @public
 */
const config: Config[] = defineConfig(
	{
		// Files biome already owns OR generated artifacts that lint
		// shouldn't touch.
		ignores: [
			"node_modules/**",
			"dist/**",
			"coverage/**",
			"reports/**",
			"generated/**",
			"web/**",
			"docs/**",
			"fixtures/**",
			"queries/**",
			"schemas/repos-schema.json",
			"issues/**",
			"categories/**",
			"tags/**",
			".github-stars/data/**",
			".tmp-repro/**",
			".tmp-*.log",
			"**/*.bak",
			// Legacy node-shaped scripts that biome already lints with
			// per-script overrides; eslint adds nothing useful for them.
			"scripts/migrate-data.js",
			"scripts/migrate-data-regex.js",
			"scripts/recover-stars-from-rest.mjs",
			"scripts/reconstruct-repos-yml.mjs",
			"scripts/generate-readmes.js",
		],
	},
	// Self-config block: ensures eslint.config.ts and other root TS
	// configs parse cleanly under typescript-eslint without requiring
	// projectService — these files are loaded via jiti, not tsc.
	{
		files: ["eslint.config.ts", "knip.ts", "github-stars.paths.config.ts"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: { ecmaVersion: 2024, sourceType: "module" },
		},
	},
	// eslint-plugin-security recommended config. Enables detect-unsafe-regex,
	// detect-eval-with-expression, detect-pseudoRandomBytes, detect-bidi-
	// characters (Trojan Source), detect-non-literal-regexp, detect-non-
	// literal-require, detect-no-csrf-before-method-override, detect-new-
	// buffer, detect-buffer-noassert, detect-child-process, detect-disable-
	// mustache-escape, detect-possible-timing-attacks. Two rules off below
	// with citations.
	securityPlugin.configs.recommended,
	{
		rules: {
			// detect-object-injection: per the rule's own docs
			// (refs/eslint-community/eslint-plugin-security/docs/rules/
			// detect-object-injection.md L28): "This rule flags any
			// expression in the form of `object[expression]` no matter
			// where it occurs." That fires on every typed-record bracket
			// access in this codebase — `record[k]` over a statically-
			// known `Record<K, V>` is by definition safe under
			// `noUncheckedIndexedAccess`. The plugin maintainers themselves
			// flag this in their README L7: "This project will help
			// identify potential security hotspots, but finds a lot of
			// false positives which need triage by a human."
			"security/detect-object-injection": "off",
			// detect-non-literal-fs-filename: src/host-io/** IS the
			// repo-wide boundary that takes dynamic filenames by design
			// (eslint's no-restricted-imports above quarantines node:fs
			// to that single dir). The rule fires in the exact place
			// where it's wrong; outside host-io there are no node:fs
			// imports for it to flag.
			"security/detect-non-literal-fs-filename": "off",
		},
	},
	// Repo-wide TypeScript linting — apply to src/ + tests/ + scripts/ in
	// our shape. Public-API JSDoc gate is a separate block below scoped
	// to src/ only.
	{
		files: ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts"],
		plugins: {
			n: nodePlugin,
		},
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				ecmaVersion: 2024,
				sourceType: "module",
				// Typed linting per typescript-eslint.io/getting-started/typed-linting.
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"no-restricted-imports": RESTRICTED_IMPORTS_OPTIONS,
			"n/no-sync": NO_SYNC_OPTIONS,
			// Two-layer console ban: ESLint sees AST-level calls; biome
			// catches some it misses (and vice-versa).
			"no-console": "error",
		},
	},
	// eslint-plugin-zod recommended — applies the zod best-practice rules
	// to every .ts file that imports from "zod".
	zodPlugin.configs.recommended as Config,
	// TSDoc spec-conformance gate + clone-friendly require-jsdoc.
	//
	// Canonical surface per `refs/microsoft/tsdoc/eslint-plugin/README.md`
	// is the rule `tsdoc/syntax`. We layer `require-jsdoc` on top of it
	// because github-stars is a clone-friendly STARTER REPO — TSDocs are
	// the contract surface a forking developer reads first to understand
	// what each public export does. The doctrine: every exported symbol
	// in `src/**` carries a TSDoc comment; tests + scripts do not.
	//
	// `publicOnly.ancestorsOnly: true` means only items REACHABLE through
	// a re-export chain count as public — internal helpers exported
	// purely to share between sibling files are exempt unless they reach
	// a barrel (`index.ts`) at some level above them.
	//
	// What constitutes a comment is governed by Microsoft TSDoc canon
	// (refs/microsoft/tsdoc/tsdoc/README.md): use Core tags first
	// (`@param` / `@returns` / `@remarks` / `@deprecated` / `@typeParam`
	// / `@privateRemarks`), Extended when warranted (`@example` /
	// `@throws` / `@see`), and the Discretionary stage tags
	// (`@public` / `@internal` / `@beta` / `@alpha`) are allowed but
	// only meaningful under API Extractor.
	{
		files: ["src/**/*.ts", "src/**/*.tsx"],
		ignores: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		plugins: {
			jsdoc,
			tsdoc: tsdocPlugin,
		},
		settings: {
			jsdoc: {
				mode: "typescript",
			},
		},
		rules: {
			// Canonical TSDoc rule (per eslint-plugin-tsdoc README L57-58).
			"tsdoc/syntax": "warn",
			// Allow only the spec's standard tags — typos and non-spec
			// tags fail this. The `typed: false` keeps `@public` valid
			// alongside the TS type system (TSDoc convention; @public is
			// a Discretionary stage marker, not a type assertion).
			"jsdoc/check-tag-names": [
				"error",
				{
					definedTags: TSDOC_STANDARD_TAGS,
					typed: false,
				},
			],
			// When `@param` IS written, the names must match the actual
			// signature.
			"jsdoc/check-param-names": [
				"error",
				{
					checkDestructured: false,
					disableMissingParamChecks: true,
				},
			],
			// When `@property` IS written, the names must match the type.
			"jsdoc/check-property-names": "error",
			// TS owns types; doc blocks must not redeclare them as
			// `{type}` annotations. Per TSDoc spec — the parameter type
			// comes from TS itself, not from `@param {string}`.
			"jsdoc/no-types": "error",
			"jsdoc/no-undefined-types": "off",
			// Require TSDoc on exported declarations reachable via a
			// barrel re-export chain. Auto-fixer is OFF — empty stubs
			// are the cargo-cult anti-pattern; humans must write the
			// content. Per starter-repo doctrine.
			"jsdoc/require-jsdoc": [
				"error",
				{
					enableFixer: false,
					publicOnly: {
						ancestorsOnly: true,
						cjs: true,
						esm: true,
					},
					require: {
						ArrowFunctionExpression: false,
						ClassDeclaration: true,
						FunctionDeclaration: true,
						FunctionExpression: false,
						MethodDefinition: false,
					},
					contexts: [
						"ExportNamedDeclaration > FunctionDeclaration",
						"ExportDefaultDeclaration > FunctionDeclaration",
						"ExportNamedDeclaration > ClassDeclaration",
						"ExportDefaultDeclaration > ClassDeclaration",
						"ExportNamedDeclaration > VariableDeclaration",
						"ExportNamedDeclaration > TSInterfaceDeclaration",
						"ExportNamedDeclaration > TSTypeAliasDeclaration",
						"ExportNamedDeclaration > TSEnumDeclaration",
					],
				},
			],
		},
	},
	// Named exception: src/host-io/** is the SOLE allowed importer of
	// node:fs / node:os / node:path / node:crypto / etc. Banned everywhere
	// else by the repo-wide rule above.
	{
		files: ["src/host-io/**/*.ts"],
		rules: {
			"no-restricted-imports": "off",
			"n/no-sync": "off",
		},
	},
	// Named exception: src/telemetry/** is the SOLE allowed importer of
	// pino + @opentelemetry/* + pino-opentelemetry-transport.
	{
		files: ["src/telemetry/**/*.ts"],
		rules: {
			"no-restricted-imports": "off",
			"no-console": "off",
		},
	},
	// Named exception: src/contracts/registry.ts uses zod's first-party
	// registry API. The eslint-plugin-zod prefer-meta and
	// consistent-schema-var-name rules fire inside the registry
	// implementation itself (it IS the meta layer; GhStarsSchemaRegistry
	// is a registry, not a schema, so the *Schema rename pattern doesn't
	// apply). Off only for this file.
	{
		files: ["src/contracts/registry.ts"],
		rules: {
			"zod/prefer-meta": "off",
			"zod/consistent-schema-var-name": "off",
		},
	},
	// CLI entry points may write directly to stdout/stderr (their job IS
	// to produce a wire-format response). The dual-write CLI helper +
	// commander wire formats via these channels. The carve-out only
	// disables `no-console`, not the host-io/telemetry rules.
	{
		files: [
			"src/cli/**/*.ts",
			"src/cli-normalize.ts",
			"src/cli-validate.ts",
			"src/auth/setup-doctor.ts",
			"src/fetch/cli.ts",
			"src/sync/cli.ts",
			"src/gate/cli.ts",
			"src/repro-taxonomy.ts",
		],
		rules: {
			"no-console": "off",
		},
	},
	// src/gate/cli.ts shells out to subprocess by design (the gate IS a
	// process-spawner). Allow spawnSync there. Will move to host-io's
	// spawn wrapper in #73 (then we can drop this carve-out and rely on
	// the host-io override above).
	{
		files: ["src/gate/cli.ts"],
		rules: {
			"n/no-sync": "off",
		},
	},
);

export default config;
