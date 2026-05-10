import { describe, expect, it } from "bun:test";
import { pathExistsSync } from "../host-io/index.js";
import {
	GENERATED_ARTIFACTS,
	type GeneratedArtifact,
	validateRegistry,
} from "./registry.js";

describe("GENERATED_ARTIFACTS", () => {
	it("has unique ids", () => {
		const ids = GENERATED_ARTIFACTS.map((a) => a.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("every entry has a producer and at least one consumer", () => {
		for (const a of GENERATED_ARTIFACTS) {
			expect(a.producer.length).toBeGreaterThan(0);
			expect(a.consumers.length).toBeGreaterThan(0);
		}
	});

	it("committed artifacts exist in the working tree", () => {
		const r = validateRegistry(pathExistsSync);
		expect(r.missing).toEqual([]);
	});
});

describe("validateRegistry", () => {
	it("reports missing committed artifacts", () => {
		const fakeArtifacts: GeneratedArtifact[] = [
			{
				id: "a",
				path: "present.txt",
				description: "",
				producer: "",
				consumers: ["x"],
				policy: "committed",
			},
			{
				id: "b",
				path: "missing.txt",
				description: "",
				producer: "",
				consumers: ["x"],
				policy: "committed",
			},
			{
				id: "c",
				path: "noop.txt",
				description: "",
				producer: "",
				consumers: ["x"],
				policy: "ignored",
			},
		];
		const r = validateRegistry((p) => p === "present.txt", fakeArtifacts);
		expect(r.ok).toBe(false);
		expect(r.missing).toEqual(["b (missing.txt)"]);
	});

	it("passes when all committed artifacts present, ignoring non-committed", () => {
		const fakeArtifacts: GeneratedArtifact[] = [
			{
				id: "a",
				path: "a.txt",
				description: "",
				producer: "",
				consumers: ["x"],
				policy: "committed",
			},
			{
				id: "b",
				path: "b.txt",
				description: "",
				producer: "",
				consumers: ["x"],
				policy: "artifacted",
			},
		];
		const r = validateRegistry((p) => p === "a.txt", fakeArtifacts);
		expect(r.ok).toBe(true);
	});
});
