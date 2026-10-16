import { App, Platform, Plugin } from "obsidian-test-mocks/obsidian";
import { afterEach, expect, it, vi } from "vitest";
import NearbyNotesPlugin from "../src/main";
import type { LocationProvider } from "../src/types";

afterEach(() => {
	Platform.isMobile = false;
});

async function browser(locationProvider?: LocationProvider) {
	const app = App.createConfigured__({
		files: {
			"Home.md": '---\nlocation: "0, 0"\n---\n',
			"Cafe.md": '---\nlocation: "0, 0.001"\n---\n',
			"Park.md": '---\nlocation: "0, 0.005"\n---\n',
		},
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
	plugin.index.rebuild();
	if (locationProvider) plugin.locationProvider = locationProvider;
	const view = await plugin.openNearby();
	if (!view) throw new Error("Browser did not open");
	return { app, plugin, view };
}

it("starts collapsed, keeps results outside Controls, and retains query and disclosure state", async () => {
	const { app, plugin, view } = await browser();
	try {
		const home = app.vault.getFileByPath("Home.md");
		if (!home) throw new Error("Missing reference");
		view.useNote(home.asOriginalType2__());
		const root = view.contentEl;
		const disclosure = root.querySelector("details");
		if (!disclosure) throw new Error("Missing Controls");
		expect(disclosure.open).toBe(false);
		expect(disclosure.querySelector(".nearby-results")).toBeNull();
		expect(
			Array.from(
				root.querySelectorAll(".nearby-result-name"),
				(el) => el.textContent,
			),
		).toEqual(["Cafe", "Park"]);

		disclosure.open = true;
		view.useNote(home.asOriginalType2__());
		expect(root.querySelector("details")?.open).toBe(true);
		const search = root.querySelector<HTMLInputElement>('input[type="search"]');
		if (!search) throw new Error("Missing search");
		search.value = "park";
		search.dispatchEvent(new Event("input"));
		const current = root.querySelector("details");
		if (!current) throw new Error("Missing Controls");
		current.open = false;
		view.renderResults();
		expect(current.open).toBe(false);
		expect(root.querySelector("summary")?.textContent).toContain(
			"Search: park",
		);
		expect(root.querySelectorAll(".nearby-result-name")).toHaveLength(1);
		expect(root.querySelector(".nearby-result-name")?.textContent).toBe("Park");
	} finally {
		await view.onClose();
		plugin.index.unload();
	}
});

it("requests mobile GPS only on explicit opening and keeps refresh errors visible while collapsed", async () => {
	Platform.isMobile = true;
	const getCurrentPosition = vi.fn().mockResolvedValue({
		coordinate: { latitude: 0, longitude: 0.002 },
		accuracyMeters: 5,
		timestamp: Date.now(),
	});
	const { plugin, view } = await browser({ getCurrentPosition });
	try {
		expect(getCurrentPosition).not.toHaveBeenCalled();
		await view.setState({ referenceType: "position" }, { history: false });
		expect(getCurrentPosition).not.toHaveBeenCalled();
		const command =
			Plugin.fromOriginalType2__(plugin).commands__.get("open-nearby-notes");
		if (!command?.callback) throw new Error("Missing browser command");
		await command.callback();
		expect(getCurrentPosition).toHaveBeenCalledTimes(1);
		expect(view.contentEl.querySelector("details")?.open).toBe(false);
		expect(
			Array.from(
				view.contentEl.querySelectorAll(".nearby-result-name"),
				(el) => el.textContent,
			),
		).toEqual(["Cafe", "Home", "Park"]);

		getCurrentPosition.mockRejectedValue(new Error("Permission denied"));
		await command.callback();
		const status = view.contentEl.querySelector(".nearby-status");
		expect(status?.closest("details")).toBeNull();
		expect(status?.textContent).toContain("stale position");
		expect(status?.textContent).toContain("Permission denied");
		expect(view.contentEl.querySelectorAll(".nearby-result")).toHaveLength(3);
		expect(view.contentEl.querySelector("details")?.open).toBe(false);
		expect(JSON.stringify(view.getState())).not.toContain("coordinate");
	} finally {
		await view.onClose();
		plugin.index.unload();
	}
});
