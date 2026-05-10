// Attribute scrubber for OTel span tags / log fields. Port of the C#
// `ScrubAttribute` helper from
// `../../westcore-x1/templates/dotnet-endpoint-agent/src/X1Xpress.Agent.Shared/Telemetry/OpenTelemetryRegistration.cs`
// (lines 186-219). The thresholds and shapes are 1:1 with that file —
// changing them here drifts the contract.
//
// The doctrine: OTel is OBSERVABILITY ONLY. It MUST NOT carry secrets,
// bearer tokens, or KV material. Posture facts (host.name, repo,
// verdict) bypass this scrubber because they are categorically
// non-secret. Anything that *might* be sensitive at the call site
// routes through `scrubAttribute` so a mistake here is a redaction,
// not a leak.

const JWT_MIN_LENGTH = 32;
const JWT_DOT_COUNT = 2;
const LONG_BLOB_MIN_LENGTH = 200;
const BASE64_RATIO_THRESHOLD = 0.95;

/**
 * Returns true when the character is in the base64url alphabet
 * (`A–Z`, `a–z`, `0–9`, `+`, `/`, `=`, `-`, `_`).
 *
 * @internal
 */
function isBase64Char(c: string): boolean {
	return (
		(c >= "A" && c <= "Z") ||
		(c >= "a" && c <= "z") ||
		(c >= "0" && c <= "9") ||
		c === "+" ||
		c === "/" ||
		c === "=" ||
		c === "-" ||
		c === "_"
	);
}

/**
 * Filter an OTel attribute value for secret-shaped strings. Returns a
 * redacted placeholder for known secret shapes (JWT-shape, long
 * base64-ish blob) and the original value otherwise. Empty/nullish
 * values pass through unchanged so the call site doesn't have to guard.
 *
 * Heuristics ported 1:1 from the C# template:
 * - JWT shape: `length > 32 && dot count === 2`
 * - Long base64 blob: `length > 200 && base64-alphabet ratio > 0.95`
 *
 * @public
 */
export function scrubAttribute(value: string | undefined): string | undefined {
	if (value === undefined || value === "") return value;

	if (value.length > JWT_MIN_LENGTH && countDots(value) === JWT_DOT_COUNT) {
		return "[REDACTED:jwt-shape]";
	}

	if (value.length > LONG_BLOB_MIN_LENGTH) {
		let b64 = 0;
		for (let i = 0; i < value.length; i++) {
			const c = value.charAt(i);
			if (isBase64Char(c)) b64++;
		}
		if (b64 / value.length > BASE64_RATIO_THRESHOLD) {
			return "[REDACTED:long-blob]";
		}
	}

	return value;
}

function countDots(value: string): number {
	let n = 0;
	for (let i = 0; i < value.length; i++) {
		if (value.charAt(i) === ".") n++;
	}
	return n;
}
