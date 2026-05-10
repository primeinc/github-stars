/**
 * Writer module for saving normalized manifests back to YAML
 */

import * as fs from "node:fs";
import * as yaml from "js-yaml";
import type { Manifest } from "./types.js";

/**
 * Write a manifest to a YAML file
 */
export function writeManifest(manifest: Manifest, filePath: string): void {
	const yamlContent = yaml.dump(manifest, {
		indent: 2,
		lineWidth: -1, // Don't wrap long lines
		noRefs: true, // Don't use YAML references
		sortKeys: false, // Preserve key order
	});

	fs.writeFileSync(filePath, yamlContent, "utf8");
}

/**
 * Write manifest with safe error handling
 */
export function writeManifestSafe(
	manifest: Manifest,
	filePath: string,
): { success: true } | { success: false; error: string } {
	try {
		writeManifest(manifest, filePath);
		return { success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { success: false, error: message };
	}
}
