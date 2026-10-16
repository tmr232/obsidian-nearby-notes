import { describe, expect, it } from "vitest";
import { releaseNotes } from "../scripts/release-notes";

describe("changelog release notes", () => {
	it("selects only the tagged version, not Unreleased or earlier entries", () => {
		const changelog =
			"# Changelog\r\n\r\n## [Unreleased]\r\n- Not shipped\r\n\r\n## [1.2.0] - 2026-10-16\r\n\r\n### Added\r\n- New feature\r\n\r\n## [1.1.0] - 2026-10-01\r\n- Old feature\r\n";
		expect(releaseNotes(changelog, "1.2.0")).toBe("### Added\n- New feature\n");
	});
	it.each([
		["## [1.2.0] - 2026-10-16\n- Feature", "v1.2.0"],
		["## [1.2.0] - 2026-10-16\n- Feature", "1.2.1"],
		["## [1.2.0]\n- Undated", "1.2.0"],
		["## [1.2.0] - 2026-10-16\n", "1.2.0"],
		["## [1.2.0] - 2026-10-16\n- A\n## [1.2.0] - 2026-10-16\n- B", "1.2.0"],
	])(
		"refuses ambiguous, missing, empty or invalid release entries",
		(changelog, version) => {
			expect(() => releaseNotes(changelog, version)).toThrow();
		},
	);
});
