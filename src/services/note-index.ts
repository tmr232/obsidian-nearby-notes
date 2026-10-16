import { type App, Component, TFile } from "obsidian";
import { readLocations } from "../core/frontmatter";
import type { NearbySettings } from "../core/settings";
import type { IndexedNote } from "../types";

export class NoteIndex extends Component {
	readonly notes = new Map<string, IndexedNote>();
	private readonly listeners = new Set<() => void>();
	ready = false;

	constructor(
		private readonly app: App,
		private readonly settings: () => NearbySettings,
	) {
		super();
	}

	override onload(): void {
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => this.update(file)),
		);
		this.registerEvent(
			this.app.metadataCache.on("resolved", () => {
				if (!this.ready) this.rebuild();
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				// Metadata may still be keyed by the old path during this event.
				// Move existing entries; the next metadata change refreshes contents.
				for (const [path, note] of this.notes) {
					if (path !== oldPath && !path.startsWith(`${oldPath}/`)) continue;
					this.notes.delete(path);
					const newPath = file.path + path.slice(oldPath.length);
					// Folder events precede descendant path updates in the vault.
					if (!(file instanceof TFile) || file.extension === "md")
						this.notes.set(newPath, {
							...note,
							path: newPath,
							name: file instanceof TFile ? file.basename : note.name,
						});
				}
				this.emit();
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				for (const path of this.notes.keys()) {
					if (path === file.path || path.startsWith(`${file.path}/`))
						this.notes.delete(path);
				}
				this.emit();
			}),
		);
		this.app.workspace.onLayoutReady(() => this.rebuild());
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	rebuild(): void {
		this.notes.clear();
		for (const file of this.app.vault.getMarkdownFiles()) this.read(file);
		this.ready = true;
		this.emit();
	}

	private update(file: TFile): void {
		this.read(file);
		this.emit();
	}

	private read(file: TFile): void {
		if (file.extension !== "md") {
			this.notes.delete(file.path);
			return;
		}
		const frontmatter =
			this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		const locations = readLocations(frontmatter, this.settings());
		if (locations.locations.length || locations.hasIssue)
			this.notes.set(file.path, {
				path: file.path,
				name: file.basename,
				...locations,
			});
		else this.notes.delete(file.path);
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}
	override onunload(): void {
		this.listeners.clear();
		this.notes.clear();
	}
}
