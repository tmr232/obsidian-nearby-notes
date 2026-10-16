import { App } from "obsidian-test-mocks/obsidian";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { FrontmatterRepository } from "../src/services/frontmatter";
import { NoteIndex } from "../src/services/note-index";

describe("frontmatter repository and live index", () => {
	it("serializes concurrent captures, preserves the body, and performs no duplicate write", async () => {
		const app = App.createConfigured__({
			files: { "Target.md": "---\ntags: [travel]\n---\nBody stays intact.\n" },
		});
		const file = app.vault.getFileByPath("Target.md");
		if (!file) throw new Error("Missing fixture");
		const repository = new FrontmatterRepository(
			app.asOriginalType__(),
			() => DEFAULT_SETTINGS,
		);
		const results = await Promise.all([
			repository.addLocation(file.asOriginalType2__(), {
				latitude: 1,
				longitude: 2,
			}),
			repository.addLocation(file.asOriginalType2__(), {
				latitude: 1,
				longitude: 2,
			}),
		]);
		expect(results.map((r) => r.status)).toEqual(["added", "duplicate"]);
		const before = await app.vault.read(file);
		const mtime = file.stat.mtime;
		expect(before).toContain("Body stays intact.");
		expect(app.metadataCache.getFileCache(file)?.frontmatter).toMatchObject({
			tags: ["travel"],
			location: "1.000000, 2.000000",
			locations: ["1.000000, 2.000000"],
		});
		await repository.addLocation(file.asOriginalType2__(), {
			latitude: 1,
			longitude: 2,
		});
		expect(await app.vault.read(file)).toBe(before);
		expect(file.stat.mtime).toBe(mtime);
	});
	it("rejects malformed fields and still allows subsequent captures after a repair", async () => {
		const initial = "---\nlocation: invalid\n---\nKeep me.\n";
		const app = App.createConfigured__({ files: { "Target.md": initial } });
		const file = app.vault.getFileByPath("Target.md");
		if (!file) throw new Error("Missing fixture");
		const repository = new FrontmatterRepository(
			app.asOriginalType__(),
			() => DEFAULT_SETTINGS,
		);
		await expect(
			repository.addLocation(file.asOriginalType2__(), {
				latitude: 1,
				longitude: 2,
			}),
		).rejects.toThrow("invalid location properties");
		expect(await app.vault.read(file)).toBe(initial);
		await app.fileManager.processFrontMatter(file, (fm) => {
			delete fm.location;
		});
		expect(
			(
				await repository.addLocation(file.asOriginalType2__(), {
					latitude: 1,
					longitude: 2,
				})
			).status,
		).toBe("added");
	});
	it("indexes manual edits, renamed notes and folders, deletions, and new property names", async () => {
		const app = App.createConfigured__({
			files: { "places/First.md": "---\nlocation: '1, 2'\n---\n" },
		});
		let settings = { ...DEFAULT_SETTINGS };
		const index = new NoteIndex(app.asOriginalType__(), () => settings);
		index.load();
		index.rebuild();
		const file = app.vault.getFileByPath("places/First.md");
		if (!file) throw new Error("Missing fixture");
		expect(index.notes.get(file.path)?.original).toEqual({
			latitude: 1,
			longitude: 2,
		});
		await app.fileManager.processFrontMatter(file, (fm) => {
			fm.location = "3, 4";
		});
		expect(index.notes.get(file.path)?.original).toEqual({
			latitude: 3,
			longitude: 4,
		});
		await app.vault.rename(file, "places/Second.md");
		expect(index.notes.has("places/First.md")).toBe(false);
		expect(index.notes.get("places/Second.md")?.name).toBe("Second");
		const folder = app.vault.getFolderByPath("places");
		if (!folder) throw new Error("Missing fixture folder");
		await app.vault.rename(folder, "renamed");
		expect(index.notes.has("places/Second.md")).toBe(false);
		expect(index.notes.get("renamed/Second.md")?.original).toEqual({
			latitude: 3,
			longitude: 4,
		});
		settings = { ...settings, originalLocationProperty: "gps" };
		index.rebuild();
		expect(index.notes.size).toBe(0);
		settings = { ...DEFAULT_SETTINGS };
		index.rebuild();
		await app.vault.delete(file);
		expect(index.notes.size).toBe(0);
		index.unload();
	});
});
