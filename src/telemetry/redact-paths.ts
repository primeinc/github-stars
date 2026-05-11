// Pino redact-path catalog. Single source of truth for which fields the
// pino logger censors before serialisation. Ported syntax follows the
// fast-redact path grammar (canonical for both `pino`'s `redact.paths`
// option and `@pinojs/redact`):
//
//   refs/pinojs/redact/README.md → "Path Syntax" section
//
//   - dot notation:        'user.password'
//   - bracket notation:    'headers["Authorization"]'
//   - terminal wildcard:   'users.*.password'
//   - intermediate wild:   '*.password'
//
// Discipline: enumerate concrete paths, not "redact everything". A
// catch-all glob silently no-ops on shape changes; named paths fail
// loud on rename, which is what we want.

/**
 * Pino `redact.paths` for every known secret-shaped field name the
 * github-stars kernel may log. The `*` prefix walks one level of
 * intermediate keys, so an `error.req.headers.authorization` field
 * is censored just as `req.headers.authorization` is.
 *
 * @public
 */
export const PINO_REDACT_PATHS = [
	// Top-level secret-shaped keys
	"password",
	"token",
	"secret",
	"apiKey",
	"api_key",
	"accessToken",
	"access_token",
	"refreshToken",
	"refresh_token",
	"privateKey",
	"private_key",
	"clientSecret",
	"client_secret",
	"installationToken",
	"installation_token",

	// Auth headers — match at any nesting level
	"*.headers.authorization",
	"*.headers.cookie",
	'*.headers["set-cookie"]',
	'*.headers["x-api-key"]',
	'*.headers["x-github-token"]',

	// Octokit / GitHub-shaped fields
	"auth",
	"GITHUB_TOKEN",
	"STARS_TOKEN",
	"GH_APP_PRIVATE_KEY",
] as const;

/**
 * Censor placeholder substituted in serialised log output for any path
 * that matches {@link PINO_REDACT_PATHS}. Matches the OTel
 * `scrubAttribute` placeholder family (in `./scrub.js`) for
 * grep-ability across logs and spans.
 *
 * @public
 */
export const PINO_REDACT_CENSOR = "[REDACTED]" as const;
