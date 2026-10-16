import type { App, TFile } from "obsidian";
import { type AddLocationResult, appendLocation } from "../core/frontmatter";
import type { NearbySettings } from "../core/settings";
import type { Coordinate } from "../types";

class DuplicateLocation extends Error {
	constructor(readonly result: AddLocationResult) {
		super("Duplicate location");
	}
}

export class FrontmatterRepository {
	private readonly pending = new Map<TFile, Promise<unknown>>();

	constructor(
		private readonly app: App,
		private readonly settings: () => NearbySettings,
	) {}

	addLocation(file: TFile, coordinate: Coordinate): Promise<AddLocationResult> {
		const previous = this.pending.get(file) ?? Promise.resolve();
		const operation = previous
			.catch(() => undefined)
			.then(async (): Promise<AddLocationResult> => {
				try {
					await this.app.fileManager.processFrontMatter(
						file,
						(frontmatter: Record<string, unknown>) => {
							const result = appendLocation(
								frontmatter,
								coordinate,
								this.settings(),
							);
							// Returning normally would still serialize/write YAML, even if unchanged.
							if (result.status === "duplicate")
								throw new DuplicateLocation(result);
						},
					);
					return { status: "added" };
				} catch (error) {
					if (error instanceof DuplicateLocation) return error.result;
					throw error;
				}
			});
		this.pending.set(file, operation);
		void operation
			.finally(() => {
				if (this.pending.get(file) === operation) this.pending.delete(file);
			})
			.catch(() => undefined);
		return operation;
	}
}
