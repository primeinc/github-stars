/** @type {import('dependency-cruiser').IConfiguration} */
//
// Architecture rules for github-stars. Defense-in-depth alongside
// eslint's no-restricted-imports + biome's noPrivateImports — three
// separate gates because each sees a different slice of the import
// graph (eslint resolves TS-typed imports; biome reads barrels;
// dependency-cruiser walks the runtime resolution tree including
// transitive package boundaries).
//
// Doctrine source: ../../juv2/.dependency-cruiser.mjs
// (rules ported verbatim where applicable; rule-scope `^packages`
// rewritten to `^src` because we are a flat single-package repo).
//
// Run: `bun run depcruise` (configured in package.json — invokes
// `dependency-cruiser --validate src`).

const config = {
	forbidden: [
		{
			name: "no-circular",
			severity: "error",
			comment:
				"This dependency is part of a circular relationship. You might want to revise " +
				"your solution (i.e. use dependency inversion, make sure the modules have a single responsibility).",
			from: {},
			to: {
				circular: true,
			},
		},
		{
			name: "no-orphans",
			comment:
				"This is an orphan module — it's likely not used (anymore?). Either use it or " +
				"remove it. If it's logical this module is an orphan (i.e. it's a config file), " +
				"add an exception for it in your dependency-cruiser configuration. By default " +
				"this rule does not scrutinize dot-files (e.g. .eslintrc.js), TypeScript declaration " +
				"files (.d.ts), tsconfig.json and some of the babel and webpack configs.",
			severity: "warn",
			from: {
				orphan: true,
				pathNot: [
					"(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|cts|mts|json)$", // dot files
					"[.]d[.]ts$", // TypeScript declaration files
					"(^|/)tsconfig[.]json$", // TypeScript config
					"(^|/)(?:babel|webpack)[.]config[.](?:js|cjs|mjs|ts|cts|mts|json)$",
					// CLI runners (no in-repo importer; entry from package.json scripts).
					"(^|/)src/cli-(normalize|validate)[.]ts$",
					"(^|/)src/(auth/setup-doctor|fetch/cli|sync/cli|gate/cli|gate/no-loose-zod-cli|contracts/paths-codegen)[.]ts$",
				],
			},
			to: {},
		},
		{
			name: "no-deprecated-core",
			comment:
				"A module depends on a node core module that has been deprecated. Find an alternative.",
			severity: "warn",
			from: {},
			to: {
				dependencyTypes: ["core"],
				path: [
					"^async_hooks$",
					"^punycode$",
					"^domain$",
					"^constants$",
					"^sys$",
					"^_linklist$",
					"^_stream_wrap$",
				],
			},
		},
		{
			name: "not-to-deprecated",
			comment:
				"This module uses a (version of an) npm module that has been deprecated. Either upgrade to a later " +
				"version of that module, or find an alternative. Deprecated modules are a security risk.",
			severity: "warn",
			from: {},
			to: {
				dependencyTypes: ["deprecated"],
			},
		},
		{
			name: "no-non-package-json",
			severity: "error",
			comment:
				"This module depends on an npm package that isn't in the 'dependencies' section of your package.json. " +
				"That's problematic as the package either (1) won't be available on live (2 — worse) will be " +
				"available on live with an non-guaranteed version. Fix it by adding the package to the dependencies " +
				"in your package.json.",
			from: {},
			to: {
				dependencyTypes: ["npm-no-pkg", "npm-unknown"],
				// Bun's `.bun/<pkg>@<ver>+<hash>/node_modules/<pkg>/...d.ts`
				// resolution path makes type-only imports look like runtime
				// deps to depcruise's classifier (the resolved path lives
				// outside any package.json's `dependencies` section). Type-
				// surface imports are not runtime debt — `.d.ts` is erased
				// at compile time.
				pathNot: ["[.]d[.](ts|cts|mts)$"],
			},
		},
		{
			name: "not-to-unresolvable",
			comment:
				"This module depends on a module that cannot be found ('resolved to disk'). If it's an npm " +
				"module: add it to your package.json. In all other cases you likely already know what to do.",
			severity: "error",
			from: {},
			to: {
				couldNotResolve: true,
			},
		},
		{
			name: "no-duplicate-dep-types",
			comment:
				"Likely this module depends on an external ('npm') package that occurs more than once " +
				"in your package.json i.e. both as a devDependency and in dependencies. This will cause " +
				"maintenance problems later on.",
			severity: "warn",
			from: {},
			to: {
				moreThanOneDependencyType: true,
				dependencyTypesNot: ["type-only"],
			},
		},
		{
			name: "not-to-spec",
			comment:
				"This module depends on a spec (test) file. The responsibility of a spec file is to test code. " +
				"If there's something in a spec that's of use to other modules, it doesn't have that single " +
				"responsibility anymore. Factor it out into (e.g.) a separate utility/helper.",
			severity: "error",
			from: {},
			to: {
				path: "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
			},
		},
		{
			name: "not-to-dev-dep",
			severity: "error",
			comment:
				"This module depends on an npm package from the 'devDependencies' section of your " +
				"package.json. It looks like something that ships to production, though. To prevent problems " +
				"with npm packages that aren't there on production declare it (only!) in the 'dependencies'" +
				"section of your package.json. If this module is development only — add it to the " +
				"from.pathNot re of the not-to-dev-dep rule in the dependency-cruiser configuration.",
			from: {
				path: "^src",
				pathNot: "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
			},
			to: {
				dependencyTypes: ["npm-dev"],
				dependencyTypesNot: ["type-only"],
				pathNot: ["node_modules/@types/", "[.]d[.](ts|cts|mts)$"],
			},
		},
		{
			name: "optional-deps-used",
			severity: "info",
			comment:
				"This module depends on an npm package that is declared as an optional dependency. " +
				"As this makes sense in limited situations only, it's flagged here.",
			from: {},
			to: {
				dependencyTypes: ["npm-optional"],
			},
		},
		{
			name: "peer-deps-used",
			comment:
				"This module depends on an npm package that is declared as a peer dependency. " +
				"This makes sense if your package is e.g. a plugin, but in other cases — maybe not so much.",
			severity: "warn",
			from: {},
			to: {
				dependencyTypes: ["npm-peer"],
			},
		},
	],
	options: {
		doNotFollow: {
			path: ["node_modules"],
		},
		// Detect TS-only imports that get erased at compile time so the
		// type-surface graph is visible alongside the runtime graph.
		tsPreCompilationDeps: true,
		// Detect process.getBuiltinModule calls as imports.
		detectProcessBuiltinModuleCalls: true,
		// Each consumer owns its own dependency ledger; root devDeps don't
		// bleed into per-file classification.
		combinedDependencies: false,
		// JSDoc-style imports (e.g. `import("foo")` in TSDoc `{@link}`
		// references) are scanned alongside real imports.
		detectJSDocImports: true,
		tsConfig: {
			fileName: "tsconfig.json",
		},
		skipAnalysisNotInRules: true,
		builtInModules: {
			add: [
				"bun",
				"bun:ffi",
				"bun:jsc",
				"bun:sqlite",
				"bun:test",
				"bun:wrap",
				"detect-libc",
				"undici",
				"ws",
			],
		},
		enhancedResolveOptions: {
			exportsFields: ["exports"],
			conditionNames: ["import", "require", "node", "default", "types"],
			mainFields: ["module", "main", "types", "typings"],
		},
		reporterOptions: {
			dot: {
				collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)",
			},
			archi: {
				collapsePattern:
					"^(?:src|lib(s?)|app(s?)|bin|test(s?)|spec(s?))/[^/]+|node_modules/(?:@[^/]+/[^/]+|[^/]+)",
			},
			text: {
				highlightFocused: true,
			},
		},
	},
};

export default config;
