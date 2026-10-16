import { Notice, Platform, Plugin } from "obsidian";
import { formatCoordinate, formatDistance } from "./core/coordinates";
import {
	DEFAULT_SETTINGS,
	loadSettings,
	type NearbySettings,
} from "./core/settings";
import { FrontmatterRepository } from "./services/frontmatter";
import { DeviceLocationProvider } from "./services/geolocation";
import { NoteIndex } from "./services/note-index";
import type { LocationProvider } from "./types";
import { NearbyView, VIEW_TYPE } from "./ui/nearby-view";
import { NearbySettingsTab } from "./ui/settings-tab";

export default class NearbyNotesPlugin extends Plugin {
	override settings: NearbySettings = { ...DEFAULT_SETTINGS };
	index!: NoteIndex;
	locationProvider!: LocationProvider;
	private repository!: FrontmatterRepository;
	private stopped = false;

	override async onload(): Promise<void> {
		this.stopped = false;
		this.settings = loadSettings(await this.loadData());
		this.locationProvider = new DeviceLocationProvider(
			() => this.settings,
			Platform.isMobile,
		);
		this.repository = new FrontmatterRepository(this.app, () => this.settings);
		this.index = this.addChild(new NoteIndex(this.app, () => this.settings));
		this.registerView(VIEW_TYPE, (leaf) => new NearbyView(leaf, this));
		this.addSettingTab(new NearbySettingsTab(this.app, this));
		this.addRibbonIcon(
			"map-pin-plus",
			"Add current location",
			() => void this.captureLocation(),
		);
		this.addCommand({
			id: "add-current-location",
			name: "Add current location to active note",
			callback: () => this.captureLocation(),
		});
		this.addCommand({
			id: "open-nearby-notes",
			name: "Open nearby-notes browser",
			callback: async () => {
				const view = await this.openNearby();
				if (Platform.isMobile) await view?.useCurrentPosition();
			},
		});
		this.addCommand({
			id: "find-notes-near-active-note",
			name: "Browse near active note",
			callback: async () => {
				const file = this.app.workspace.getActiveFile();
				if (file?.extension !== "md") {
					new Notice("Open a Markdown note to browse nearby");
					return;
				}
				const view = await this.openNearby();
				view?.useNote(file);
			},
		});
		this.addCommand({
			id: "copy-current-coordinates",
			name: "Copy current GPS coordinates",
			callback: async () => {
				try {
					const fix = await this.locationProvider.getCurrentPosition();
					if (this.stopped) return;
					await navigator.clipboard.writeText(
						formatCoordinate(fix.coordinate, this.settings.coordinatePrecision),
					);
					this.captureNotice("Coordinates copied");
				} catch (error) {
					this.reportError(error);
				}
			},
		});
	}

	async captureLocation(): Promise<void> {
		// Resolve the target before awaiting permission or GPS, never afterward.
		const file = this.app.workspace.getActiveFile();
		if (file?.extension !== "md") {
			new Notice("Open a Markdown note to add a location");
			return;
		}
		try {
			const fix = await this.locationProvider.getCurrentPosition();
			if (this.stopped) return;
			if (this.app.vault.getAbstractFileByPath(file.path) !== file)
				throw new Error("The target note no longer exists");
			const result = await this.repository.addLocation(file, fix.coordinate);
			if (this.stopped) return;
			this.captureNotice(
				result.status === "added"
					? `Location added: ${formatCoordinate(fix.coordinate, this.settings.coordinatePrecision)}`
					: `Location already recorded nearby (${formatDistance(result.distanceMeters, this.settings.distanceUnits)})`,
			);
		} catch (error) {
			this.reportError(error);
		}
	}

	async openNearby(): Promise<NearbyView | undefined> {
		let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (!leaf) {
			const rightLeaf = this.app.workspace.getRightLeaf(false);
			if (!rightLeaf) return;
			leaf = rightLeaf;
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
		return leaf.view instanceof NearbyView ? leaf.view : undefined;
	}

	async updateSettings(settings: NearbySettings): Promise<void> {
		await this.saveData(settings);
		this.settings = settings;
		this.index.rebuild();
	}

	private captureNotice(message: string): void {
		if (this.settings.showCaptureNotices && !this.stopped) new Notice(message);
	}
	private reportError(error: unknown): void {
		if (!this.stopped)
			new Notice(
				error instanceof Error ? error.message : "Couldn't update location",
			);
	}
	override onunload(): void {
		this.stopped = true;
	}
}
