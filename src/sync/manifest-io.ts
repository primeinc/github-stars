// Read/write repos.yml using js-yaml (already a project dep).
//
// 02-sync historically shelled out to `yq eval -o=json -` and then back to
// `yq eval '.' manifest.json -o=yaml`. js-yaml gives the same round trip
// without needing yq pre-installed; tests hit this path directly.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import yaml from "js-yaml";
import type { Manifest } from "./reconcile.js";

const TEMPLATE_PATH = ".github-stars/repos-template.yml";

export function loadManifest(path: string): Manifest {
	const source = existsSync(path) ? path : TEMPLATE_PATH;
	if (!existsSync(source)) {
		throw new Error(
			`Manifest not found at ${path} and template ${TEMPLATE_PATH} also missing`,
		);
	}
	const raw = readFileSync(source, "utf8");
	const parsed = yaml.load(raw) as Manifest | null;
	if (!parsed || typeof parsed !== "object") {
		throw new Error(`Manifest at ${source} did not parse to an object`);
	}
	if (!Array.isArray(parsed.repositories)) parsed.repositories = [];
	return parsed;
}

export function writeManifest(path: string, manifest: Manifest): void {
	const text = yaml.dump(manifest, {
		lineWidth: -1,
		noRefs: true,
		sortKeys: false,
		forceQuotes: false,
	});
	writeFileSync(path, text);
}
