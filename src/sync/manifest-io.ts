// Read/write repos.yml using js-yaml. js-yaml gives the round trip yq
// historically did without needing yq pre-installed; tests hit this path
// directly.

import yaml from "js-yaml";
import { getGhStarsPath } from "../contracts/paths.js";
import {
	pathExistsSync,
	readTextFileSync,
	writeTextFileAtomicSync,
} from "../host-io/index.js";
import type { Manifest } from "./reconcile.js";

const TEMPLATE_PATH = getGhStarsPath("reposTemplate");

/**
 * Load a manifest from `path`, falling back to the bundled template
 * when the manifest is absent.
 *
 * @public
 */
export function loadManifest(path: string): Manifest {
	const source = pathExistsSync(path) ? path : TEMPLATE_PATH;
	if (!pathExistsSync(source)) {
		throw new Error(
			`Manifest not found at ${path} and template ${TEMPLATE_PATH} also missing`,
		);
	}
	const raw = readTextFileSync(source);
	const parsed = yaml.load(raw) as Manifest | null;
	if (!parsed || typeof parsed !== "object") {
		throw new Error(`Manifest at ${source} did not parse to an object`);
	}
	if (!Array.isArray(parsed.repositories)) parsed.repositories = [];
	return parsed;
}

/**
 * Atomically write `manifest` back to `path`.
 *
 * @public
 */
export function writeManifest(path: string, manifest: Manifest): void {
	const text = yaml.dump(manifest, {
		lineWidth: -1,
		noRefs: true,
		sortKeys: false,
		forceQuotes: false,
	});
	writeTextFileAtomicSync(path, text);
}
