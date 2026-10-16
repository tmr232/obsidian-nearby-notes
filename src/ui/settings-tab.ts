import { type App, Notice, PluginSettingTab, Setting } from "obsidian";
import { type NearbySettings, validateSettings } from "../core/settings";
import type NearbyNotesPlugin from "../main";

export class NearbySettingsTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: NearbyNotesPlugin,
	) {
		super(app, plugin);
	}

	override display(): void {
		const root = this.containerEl;
		root.empty();
		new Setting(root).setName("Location properties").setHeading();
		root.createEl("p", {
			text: "Changing property names affects reading and writing immediately. Existing notes are not migrated or rewritten.",
		});
		this.text(
			"originalLocationProperty",
			"Original location property",
			"The first recorded location is preserved.",
		);
		this.text(
			"locationsProperty",
			"Location history property",
			"An ordered list of recorded coordinates.",
		);
		new Setting(root).setName("Capture").setHeading();
		this.number(
			"duplicateRadiusMeters",
			"Duplicate radius (metres)",
			"Skip captures this close to any recorded point. Zero skips only identical points.",
		);
		this.number(
			"coordinatePrecision",
			"Decimal places",
			"New coordinates only. Default: 6. Allowed: 0–10.",
		);
		this.number(
			"gpsTimeoutMs",
			"GPS timeout (milliseconds)",
			"Default: 15000. Allowed: 1000–120000.",
		);
		this.number(
			"maximumGpsAccuracyMeters",
			"Maximum GPS uncertainty (metres)",
			"Reject readings with greater reported uncertainty. Default: 100.",
		);
		new Setting(root)
			.setName("Capture notices")
			.setDesc(
				"Show successful captures and duplicate notices. Errors are always shown.",
			)
			.addToggle((toggle) => {
				toggle.toggleEl.setAttribute("aria-label", "Capture notices");
				toggle
					.setValue(this.plugin.settings.showCaptureNotices)
					.onChange((value) => this.save({ showCaptureNotices: value }));
			});
		new Setting(root).setName("Nearby browser").setHeading();
		new Setting(root).setName("Distance units").addDropdown((dropdown) => {
			dropdown.selectEl.setAttribute("aria-label", "Distance units");
			dropdown
				.addOptions({ metric: "Metric", imperial: "Imperial" })
				.setValue(this.plugin.settings.distanceUnits)
				.onChange((value) =>
					this.save({
						distanceUnits: value === "imperial" ? "imperial" : "metric",
					}),
				);
		});
		new Setting(root)
			.setName("Default distance mode")
			.addDropdown((dropdown) => {
				dropdown.selectEl.setAttribute("aria-label", "Default distance mode");
				dropdown
					.addOptions({
						nearest: "Nearest location",
						original: "Original location",
					})
					.setValue(this.plugin.settings.defaultDistanceMode)
					.onChange((value) =>
						this.save({
							defaultDistanceMode:
								value === "original" ? "original" : "nearest",
						}),
					);
			});
		this.number(
			"defaultMaxDistanceMeters",
			"Default maximum distance (metres)",
			"Leave empty for all distances. Applies to newly opened browsers.",
		);
		new Setting(root).setName("Privacy").setHeading();
		root.createEl("p", {
			text: "Nearby Notes makes no network requests and does not track your location in the background. Coordinates are stored only in note frontmatter, not plugin settings or logs. Your vault’s sync and backup services may copy this sensitive data.",
		});
	}

	private text(
		key: "originalLocationProperty" | "locationsProperty",
		name: string,
		description: string,
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(description)
			.addText((text) => {
				text.inputEl.setAttribute("aria-label", name);
				text.setValue(this.plugin.settings[key]);
				text.inputEl.addEventListener(
					"change",
					() => void this.save({ [key]: text.getValue() }),
				);
			});
	}

	private number(
		key:
			| "duplicateRadiusMeters"
			| "coordinatePrecision"
			| "gpsTimeoutMs"
			| "maximumGpsAccuracyMeters"
			| "defaultMaxDistanceMeters",
		name: string,
		description: string,
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(description)
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.setAttribute("aria-label", name);
				text.setValue(this.plugin.settings[key]?.toString() ?? "");
				text.inputEl.addEventListener("change", () => {
					const value = text.getValue().trim();
					void this.save({
						[key]:
							value === "" && key === "defaultMaxDistanceMeters"
								? null
								: value === ""
									? Number.NaN
									: Number(value),
					});
				});
			});
	}

	private async save(patch: Partial<NearbySettings>): Promise<void> {
		const settings = { ...this.plugin.settings, ...patch };
		const error = validateSettings(settings);
		if (error) {
			new Notice(error);
			return;
		}
		try {
			await this.plugin.updateSettings(settings);
		} catch {
			new Notice("Couldn't save Nearby Notes settings");
		}
	}
}
