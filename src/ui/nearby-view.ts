import {
	FuzzySuggestModal,
	ItemView,
	Platform,
	Setting,
	type TFile,
	type ViewStateResult,
	type WorkspaceLeaf,
} from "obsidian";
import { formatCoordinate, formatDistance } from "../core/coordinates";
import { queryNearby } from "../core/query";
import type NearbyNotesPlugin from "../main";
import type { DistanceMode, PositionFix } from "../types";

export const VIEW_TYPE = "nearby-notes";

class NotePicker extends FuzzySuggestModal<TFile> {
	constructor(
		private readonly plugin: NearbyNotesPlugin,
		private readonly choose: (file: TFile) => void,
	) {
		super(plugin.app);
		this.setPlaceholder("Search Markdown notes…");
	}
	getItems(): TFile[] {
		return this.plugin.app.vault.getMarkdownFiles();
	}
	getItemText(file: TFile): string {
		return file.path;
	}
	onChooseItem(file: TFile): void {
		this.choose(file);
	}
}

export class NearbyView extends ItemView {
	private referenceType: "position" | "note" = Platform.isMobile
		? "position"
		: "note";
	private referenceFile: TFile | null = null;
	private fix: PositionFix | null = null;
	private stale = false;
	private requesting = false;
	private requestId = 0;
	private search = "";
	private mode: DistanceMode;
	private maxDistance: number | null;
	private message = "";
	private disclosureEl?: HTMLDetailsElement;
	private summaryEl!: HTMLElement;
	private statusEl!: HTMLElement;
	private referenceEl!: HTMLElement;
	private resultsEl!: HTMLElement;
	private noteButton!: HTMLButtonElement;
	private refreshButton!: HTMLButtonElement;
	private customDistance!: HTMLInputElement;
	private unsubscribe?: () => void;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: NearbyNotesPlugin,
	) {
		super(leaf);
		this.mode = plugin.settings.defaultDistanceMode;
		this.maxDistance = plugin.settings.defaultMaxDistanceMeters;
	}

	getViewType(): string {
		return VIEW_TYPE;
	}
	getDisplayText(): string {
		return "Nearby Notes";
	}
	override getIcon(): string {
		return "map-pin";
	}

	override getState(): Record<string, unknown> {
		// Workspace state may remember a note/query, but never GPS coordinates.
		return {
			referenceType: this.referenceType,
			referencePath: this.referenceFile?.path,
			mode: this.mode,
			search: this.search,
			maxDistance: this.maxDistance,
		};
	}

	override async setState(
		state: unknown,
		result: ViewStateResult,
	): Promise<void> {
		if (state && typeof state === "object") {
			const saved = state as Record<string, unknown>;
			if (saved.referenceType === "note" || saved.referenceType === "position")
				this.referenceType = saved.referenceType;
			if (typeof saved.referencePath === "string")
				this.referenceFile = this.app.vault.getFileByPath(saved.referencePath);
			if (saved.mode === "original" || saved.mode === "nearest")
				this.mode = saved.mode;
			if (typeof saved.search === "string") this.search = saved.search;
			if (
				saved.maxDistance === null ||
				(typeof saved.maxDistance === "number" &&
					Number.isFinite(saved.maxDistance) &&
					saved.maxDistance >= 0)
			)
				this.maxDistance = saved.maxDistance;
		}
		this.build();
		this.renderResults();
		await super.setState(state, result);
	}

	override async onOpen(): Promise<void> {
		this.build();
		this.unsubscribe = this.plugin.index.subscribe(() => this.renderResults());
		this.registerEvent(this.app.vault.on("rename", () => this.renderResults()));
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (
					file === this.referenceFile ||
					(this.referenceFile &&
						!this.app.vault.getAbstractFileByPath(this.referenceFile.path))
				) {
					this.referenceFile = null;
					this.message = "The reference note was deleted. Choose another note.";
				}
				this.renderResults();
			}),
		);
		this.renderResults();
		// Restoring a workspace never requests permission. GPS requires an explicit
		// browser command, reference selection, or Refresh action.
	}

	override async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.requestId++;
		this.contentEl.empty();
	}

	useNote(file: TFile): void {
		this.referenceType = "note";
		this.referenceFile = file;
		this.message = "";
		this.build();
		this.renderResults();
	}

	async useCurrentPosition(): Promise<void> {
		this.referenceType = "position";
		this.build();
		this.renderResults();
		await this.refreshPosition();
	}

	private build(): void {
		const controlsOpen = this.disclosureEl?.open ?? false;
		const root = this.contentEl;
		root.empty();
		root.addClass("nearby-notes-view");
		root.createEl("h2", { text: "Nearby Notes" });
		const disclosure = root.createEl("details", { cls: "nearby-disclosure" });
		disclosure.open = controlsOpen;
		this.disclosureEl = disclosure;
		const summary = disclosure.createEl("summary", { text: "Controls" });
		this.summaryEl = summary.createSpan("nearby-query-summary");
		const controls = disclosure.createDiv("nearby-controls");
		new Setting(controls).setName("Reference").addDropdown((dropdown) => {
			dropdown.selectEl.setAttribute("aria-label", "Reference");
			dropdown
				.addOption("position", "Current position")
				.addOption("note", "Note")
				.setValue(this.referenceType)
				.onChange((value) => {
					this.referenceType = value === "position" ? "position" : "note";
					this.message = "";
					this.renderResults();
					if (this.referenceType === "position" && !this.fix)
						void this.refreshPosition();
				});
		});
		const actions = controls.createDiv("nearby-reference-actions");
		this.noteButton = actions.createEl("button", {
			text: "Choose reference note",
		});
		this.noteButton.addEventListener("click", () =>
			new NotePicker(this.plugin, (file) => this.useNote(file)).open(),
		);
		this.refreshButton = actions.createEl("button", {
			text: "Refresh position",
		});
		this.refreshButton.addEventListener(
			"click",
			() => void this.refreshPosition(),
		);
		this.referenceEl = controls.createDiv({
			cls: "nearby-reference",
			attr: { "aria-live": "polite" },
		});
		new Setting(controls).setName("Distance to").addDropdown((dropdown) => {
			dropdown.selectEl.setAttribute("aria-label", "Distance to");
			dropdown
				.addOption("nearest", "Nearest location")
				.addOption("original", "Original location")
				.setValue(this.mode)
				.onChange((value) => {
					this.mode = value === "original" ? "original" : "nearest";
					this.renderResults();
				});
		});
		const distances = {
			all: "All distances",
			"100": "100 m",
			"500": "500 m",
			"1000": "1 km",
			"5000": "5 km",
			"10000": "10 km",
			custom: "Custom",
		};
		const selected =
			this.maxDistance === null
				? "all"
				: Object.hasOwn(distances, String(this.maxDistance))
					? String(this.maxDistance)
					: "custom";
		new Setting(controls).setName("Within").addDropdown((dropdown) => {
			dropdown.selectEl.setAttribute("aria-label", "Within");
			dropdown
				.addOptions(distances)
				.setValue(selected)
				.onChange((value) => {
					this.customDistance.hidden = value !== "custom";
					if (value === "custom") {
						this.customDistance.focus();
						return;
					}
					this.maxDistance = value === "all" ? null : Number(value);
					this.renderResults();
				});
		});
		this.customDistance = controls.createEl("input", {
			type: "number",
			attr: {
				"aria-label": "Custom maximum distance in metres",
				min: "0",
				step: "any",
				placeholder: "Maximum distance (metres)",
			},
		});
		this.customDistance.hidden = selected !== "custom";
		this.customDistance.value =
			this.maxDistance === null ? "" : String(this.maxDistance);
		this.customDistance.addEventListener("input", () => {
			const value = this.customDistance.valueAsNumber;
			const valid = Number.isFinite(value) && value >= 0;
			this.customDistance.setCustomValidity(
				valid ? "" : "Enter a distance of zero metres or greater.",
			);
			if (valid) {
				this.maxDistance = value;
				this.renderResults();
			}
		});
		const search = controls.createEl("input", {
			type: "search",
			attr: {
				"aria-label": "Search nearby notes",
				placeholder: "Search notes…",
			},
		});
		search.value = this.search;
		search.addEventListener("input", () => {
			this.search = search.value;
			this.renderResults();
		});
		this.statusEl = root.createDiv({
			cls: "nearby-status",
			attr: { "aria-live": "polite" },
		});
		this.resultsEl = root.createDiv({
			cls: "nearby-results",
			attr: { "aria-live": "polite" },
		});
	}

	private async refreshPosition(): Promise<void> {
		if (this.requesting) return;
		const request = ++this.requestId;
		this.requesting = true;
		this.message = "";
		this.renderResults();
		try {
			const fix = await this.plugin.locationProvider.getCurrentPosition();
			if (request !== this.requestId) return;
			this.fix = fix;
			this.stale = false;
		} catch (error) {
			if (request !== this.requestId) return;
			this.stale = true;
			this.message =
				error instanceof Error
					? error.message
					: "Couldn't obtain device location";
		} finally {
			if (request === this.requestId) {
				this.requesting = false;
				this.renderResults();
			}
		}
	}

	renderResults(): void {
		if (!this.resultsEl) return;
		const isPosition = this.referenceType === "position";
		this.summaryEl.textContent = [
			isPosition
				? "Current position"
				: (this.referenceFile?.basename ?? "Note"),
			this.mode === "nearest" ? "Nearest location" : "Original location",
			this.maxDistance === null
				? "All distances"
				: `Within ${formatDistance(this.maxDistance, this.plugin.settings.distanceUnits)}`,
			...(this.search ? [`Search: ${this.search}`] : []),
		].join(" · ");
		this.noteButton.hidden = isPosition;
		this.noteButton.textContent = this.referenceFile
			? `Change: ${this.referenceFile.basename}`
			: "Choose reference note";
		this.refreshButton.hidden = !isPosition;
		this.refreshButton.disabled = this.requesting;
		this.refreshButton.textContent = this.requesting
			? "Obtaining position…"
			: "Refresh position";
		const reference = isPosition
			? this.fix?.coordinate
			: this.referenceFile
				? this.plugin.index.notes.get(this.referenceFile.path)?.original
				: null;
		this.referenceEl.empty();
		if (reference) {
			this.referenceEl.createEl("div", {
				cls: "nearby-coordinate",
				text: formatCoordinate(
					reference,
					this.plugin.settings.coordinatePrecision,
				),
			});
			this.referenceEl.createEl("div", {
				text:
					isPosition && this.fix
						? `${this.stale ? "Stale · " : ""}Acquired ${new Date(this.fix.timestamp).toLocaleTimeString()}`
						: `Original location · ${this.referenceFile?.path}`,
			});
		}
		this.statusEl.empty();
		if (isPosition && this.requesting)
			this.statusEl.createEl("p", { text: "Obtaining position…" });
		if (isPosition && this.fix && this.stale)
			this.statusEl.createEl("p", {
				cls: "nearby-warning",
				text: `Using stale position acquired ${new Date(this.fix.timestamp).toLocaleTimeString()}.`,
			});
		if (this.message)
			this.statusEl.createEl("p", {
				cls: "nearby-warning",
				text: this.message,
			});
		this.resultsEl.empty();
		if (!reference) {
			this.resultsEl.createEl("p", {
				cls: "nearby-empty",
				text: this.requesting
					? "Waiting for a location fix…"
					: isPosition
						? "Open Controls to refresh your position and find nearby notes. Location is requested only when you ask."
						: this.referenceFile
							? "This note has no usable original location. Check its location properties or open Controls to choose another note."
							: "Open Controls to choose a note with a recorded location. No GPS needed.",
			});
			return;
		}
		const results = queryNearby(
			this.plugin.index.notes.values(),
			reference,
			this.mode,
			{
				excludePath: isPosition ? undefined : this.referenceFile?.path,
				search: this.search,
				maxDistanceMeters: this.maxDistance,
			},
		);
		this.resultsEl.createEl("p", {
			cls: "nearby-count",
			text: `${results.length} ${results.length === 1 ? "note" : "notes"} nearby`,
		});
		const issues = [...this.plugin.index.notes.values()].filter(
			(note) => note.hasIssue,
		).length;
		if (issues)
			this.resultsEl.createEl("p", {
				cls: "nearby-warning",
				text: `${issues} ${issues === 1 ? "note has" : "notes have"} invalid location properties. Only usable coordinates are shown.`,
			});
		if (!results.length)
			this.resultsEl.createEl("p", {
				cls: "nearby-empty",
				text: "No notes match. Try a wider distance or a different search.",
			});
		const list = this.resultsEl.createEl("ul", { cls: "nearby-list" });
		for (const result of results) {
			const row = list.createEl("li");
			const button = row.createEl("button", {
				cls: "nearby-result",
				attr: {
					"aria-label": `Open ${result.note.path}, ${formatDistance(result.distanceMeters, this.plugin.settings.distanceUnits)}`,
				},
			});
			const title = button.createSpan("nearby-result-heading");
			title.createSpan({ cls: "nearby-result-name", text: result.note.name });
			title.createSpan({
				cls: "nearby-distance",
				text: formatDistance(
					result.distanceMeters,
					this.plugin.settings.distanceUnits,
				),
			});
			button.createSpan({
				cls: "nearby-result-detail",
				text: `${result.note.path} · ${result.note.locations.length} ${result.note.locations.length === 1 ? "location" : "locations"}${result.note.hasIssue ? " · Metadata issue" : ""}`,
			});
			button.addEventListener("click", () => {
				// Never open into this sidebar leaf, and never depend on the active editor.
				void this.app.workspace.openLinkText(result.note.path, "", false);
			});
		}
	}
}
