// Public surface of the privacy / quarantine kernel. Per issue #74,
// every public-mode workflow that emits repo identifiers, summaries,
// classifier inputs, or artifacts routes its outputs through these
// helpers. The fetch path filters private records upstream; this
// module is the downstream defence-in-depth tripwire.

export type {
	OutputVisibility,
	PrivateOmissionReport,
} from "./private-quarantine.js";
export {
	OUTPUT_VISIBILITY,
	OutputVisibilitySchema,
	PRIVATE_SENTINEL_SLUG,
	PrivateOmissionReportSchema,
} from "./private-quarantine.js";
export type {
	QuarantinedRepoLike,
	QuarantineResult,
} from "./quarantine.js";
export {
	assertNoPrivateLeak,
	findPrivateSlugLeaks,
	PrivateLeakError,
	publicSafeOmissionReport,
	quarantinePrivate,
} from "./quarantine.js";
