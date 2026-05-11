// Loader module for reading and parsing repos.yml manifest.

import * as yaml from "js-yaml";
import { pathExistsSync, readTextFileSync } from "../host-io/index.js";
import type { Manifest } from "./types.js";

/**
 * Load and parse a YAML manifest file.
 *
 * @public
 */
export function loadManifest(filePath: string): Manifest {
	if (!pathExistsSync(filePath)) {
		throw new Error(`Manifest file not found: ${filePath}`);
	}

	const content = readTextFileSync(filePath);
	const data = yaml.load(content) as Manifest;

	if (!data || typeof data !== "object") {
		throw new Error("Invalid manifest: not a valid YAML object");
	}

	if (!data.taxonomy || !Array.isArray(data.taxonomy.categories_allowed)) {
		throw new Error("Invalid manifest: missing or invalid taxonomy");
	}

	if (!Array.isArray(data.repositories)) {
		throw new Error("Invalid manifest: repositories must be an array");
	}

	return data;
}

/**
 * Load manifest with error handling and detailed messages.
 *
 * @public
 */
export function loadManifestSafe(
	filePath: string,
): { success: true; manifest: Manifest } | { success: false; error: string } {
	try {
		const manifest = loadManifest(filePath);
		return { success: true, manifest };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { success: false, error: message };
	}
}
