// Writer module for saving normalized manifests back to YAML.

import * as yaml from "js-yaml";
import { writeTextFileAtomicSync } from "../host-io/index.js";
import type { Manifest } from "./types.js";

/**
 * Write a manifest to a YAML file. Atomic — torn-write safe under crash.
 *
 * @public
 */
export function writeManifest(manifest: Manifest, filePath: string): void {
	const yamlContent = yaml.dump(manifest, {
		indent: 2,
		lineWidth: -1,
		noRefs: true,
		sortKeys: false,
	});

	writeTextFileAtomicSync(filePath, yamlContent);
}

/**
 * Write manifest with safe error handling.
 *
 * @public
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
