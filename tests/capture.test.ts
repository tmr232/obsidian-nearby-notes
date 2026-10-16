import { App } from "obsidian-test-mocks/obsidian";
import { expect, it } from "vitest";
import NearbyNotesPlugin from "../src/main";
import type { PositionFix } from "../src/types";

it("retains the original target while GPS is pending and stops writes after unload", async () => {
	const app = App.createConfigured__({
		files: { "Target.md": "Target body", "Other.md": "Other body" },
	});
	const plugin = new NearbyNotesPlugin(app.asOriginalType__(), {
		id: "nearby-notes",
		name: "Nearby Notes",
		version: "1.0.0",
		minAppVersion: "1.11.0",
		author: "tmr232",
		description: "Nearby notes",
	});
	await plugin.onload();
	const target = app.vault.getFileByPath("Target.md");
	const other = app.vault.getFileByPath("Other.md");
	if (!target || !other) throw new Error("Missing fixture");
	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(target);
	let resolveFix!: (fix: PositionFix) => void;
	plugin.locationProvider = {
		getCurrentPosition: () =>
			new Promise((resolve) => {
				resolveFix = resolve;
			}),
	};
	const pending = plugin.captureLocation();
	await leaf.openFile(other);
	resolveFix({
		coordinate: { latitude: 32, longitude: 34 },
		accuracyMeters: 5,
		timestamp: Date.now(),
	});
	await pending;
	expect(app.metadataCache.getFileCache(target)?.frontmatter?.location).toBe(
		"32.000000, 34.000000",
	);
	expect(await app.vault.read(other)).toBe("Other body");
	const abandoned = plugin.captureLocation();
	plugin.onunload();
	resolveFix({
		coordinate: { latitude: 33, longitude: 35 },
		accuracyMeters: 5,
		timestamp: Date.now(),
	});
	await abandoned;
	expect(await app.vault.read(other)).toBe("Other body");
	plugin.index.unload();
});
