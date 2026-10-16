/** The changelog is the source of truth for GitHub release notes. */
export function releaseNotes(changelog: string, version: string): string {
	if (!/^\d+\.\d+\.\d+$/.test(version))
		throw new Error("Use a version tag such as 1.0.0, without a v prefix.");
	const lines = changelog.replaceAll("\r\n", "\n").split("\n");
	const headings = lines.flatMap((line, index) =>
		line.startsWith(`## [${version}]`) ? [index] : [],
	);
	if (headings.length !== 1)
		throw new Error(`Expected exactly one changelog entry for ${version}.`);
	const start = headings[0];
	if (
		start === undefined ||
		!/^## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}$/.test(lines[start] ?? "")
	)
		throw new Error(
			"Release changelog headings must include a date: ## [1.0.0] - YYYY-MM-DD",
		);
	let end = start + 1;
	while (end < lines.length && !lines[end]?.startsWith("## ")) end++;
	const notes = lines
		.slice(start + 1, end)
		.join("\n")
		.trim();
	if (!notes || !/^[-*] \S/m.test(notes))
		throw new Error(`Changelog entry ${version} has no release notes.`);
	return `${notes}\n`;
}

if (import.meta.main) {
	try {
		const manifest = await Bun.file(
			new URL("../manifest.json", import.meta.url),
		).json();
		const pkg = await Bun.file(
			new URL("../package.json", import.meta.url),
		).json();
		const versions = await Bun.file(
			new URL("../versions.json", import.meta.url),
		).json();
		const version = process.argv[2] ?? manifest.version;
		if (version !== manifest.version || version !== pkg.version)
			throw new Error(
				"Release tag, manifest.json, and package.json versions must match.",
			);
		if (versions[version] !== manifest.minAppVersion)
			throw new Error(
				"versions.json must record this release's minimum Obsidian version.",
			);
		const changelog = await Bun.file(
			new URL("../CHANGELOG.md", import.meta.url),
		).text();
		process.stdout.write(releaseNotes(changelog, version));
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Couldn't generate release notes",
		);
		process.exitCode = 1;
	}
}
