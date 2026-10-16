# Nearby Notes

Record locations in your Obsidian notes and discover notes near a place. Offline-first, with no maps, accounts, external APIs, telemetry, or runtime dependencies.

Requires **Obsidian 1.11.0+**. GPS acquisition is available on **Android and iOS**; browsing relative to another note also works on desktop.

## Install from a build

1. Run `bun install --frozen-lockfile` and `bun run check`.
2. Create `<vault>/.obsidian/plugins/nearby-notes/`.
3. Copy **`main.js`**, **`manifest.json`**, and **`styles.css`** into that directory.
4. In Obsidian → Settings → Community plugins, enable Nearby Notes. Only enable community plugins you trust.

For a packaged release, download the same three files from GitHub Releases instead of building. This repository is not yet listed in Obsidian's community plugin catalog.

## Capture a location

Open a Markdown note, then tap the **Add current location** ribbon icon or run **Nearby Notes: Add current location to active note**. Allow the device's location permission when prompted.

The first successful capture creates both properties:

```yaml
---
location: "32.085300, 34.781800"
locations:
  - "32.085300, 34.781800"
---
```

Later captures append to `locations` without changing `location`. The default duplicate radius is 20 metres, measured against **all** valid points, including the original. Duplicate captures do not write the note. Setting the radius to zero skips only identical coordinates. Captures use the note selected **when the action began**, even if you switch notes before GPS finishes.

GPS requests are one-shot, high-accuracy requests, with a 15-second timeout, no cached positions, and maximum reported uncertainty of 100 metres by default. Bad coordinates, poor accuracy, stale readings, permission denial, and timeouts are rejected without modifying the note. High accuracy is a request, not a hardware guarantee. The adapter allows a one-second timestamp tolerance for the native bridge, not older cached fixes.

## Browse nearby notes

Run **Nearby Notes: Open nearby-notes browser** to open the right sidebar, or **Nearby Notes: Browse near active note** to immediately use that note as the reference. The latter requires no GPS and works on desktop.

Controls start **collapsed**, leaving the distance-sorted list in view. Expand **Controls** to change the reference, distance mode, range, or search; the compact summary shows the active query even when collapsed. GPS errors and stale-position warnings remain visible outside Controls.

On mobile, explicitly running **Open nearby-notes browser** requests a fresh current position so you can browse immediately. The default query measures to each note's nearest recorded location, with no distance limit. Desktop browsing uses a reference note instead of GPS.

- **Reference:** choose a searchable Markdown note, or select Current position and refresh GPS. The reference note always uses its **first** recorded location.
- **Distance to:** Nearest location measures to each result's closest recorded point. Original location measures only to its first point.
- **Search:** matches note names and paths, case-insensitively.
- **Within:** all distances, a preset, or a custom maximum in metres. Display units can be metric or imperial; range inputs are always metres.
- Select a result to open it in the editor without replacing the sidebar or resetting its query.

Distances are straight-line Haversine estimates, not walking/driving routes. Results exclude the reference note, sort by distance, then case-insensitive name and path. The view updates after metadata edits, sync changes, renames, and deletions. Failed GPS refreshes retain the last position and visibly label it **Stale**. No continuous tracking occurs.

Workspace state remembers note references and query controls, but **never GPS coordinates or the expanded Controls state**. Restoring the sidebar does not request location permission. After restarting, run the browser command on mobile, select Current position, or press Refresh position explicitly.

## Commands

| Command ID (prefixed with `nearby-notes:`) | Action |
| --- | --- |
| `add-current-location` | Add current location to active note |
| `open-nearby-notes` | Open nearby-notes browser |
| `find-notes-near-active-note` | Browse near active note |
| `copy-current-coordinates` | Copy only the formatted coordinate pair |

## Existing notes and safe handling

Coordinates are WGS84 decimal degrees, latitude first. Strings (`"-32.1, 34.8"`) and legacy numeric pairs (`[-32.1, 34.8]`) are accepted. New values default to six decimal places. Existing entries retain their representation and order; Obsidian may normalize YAML formatting during a successful frontmatter write.

- Only `location`: indexed normally; the next nonduplicate capture creates history from the original and the new point.
- Only `locations`: the **first entry** is the effective original; the next nonduplicate capture fills the original property and appends.
- Original absent from history: both are used for nearest-distance and duplicate checks. The plugin does not silently repair the list.
- Invalid properties: marked as metadata issues. Captures fail safely rather than overwriting them. Valid history points remain usable in Nearest mode, but an invalid explicit original is never substituted with another point in Original mode or for a reference note.
- Duplicate captures never repair or change either property.

Settings validate distinct property names, numeric ranges, precision, GPS limits, units, default filters, and capture notices. Changing property names changes reading/writing immediately, **without migrating existing notes**. Automatic migrations and repair tools are intentionally not included. Correct invalid properties manually, preferably after backing up your vault.

## Privacy

The plugin makes **no network requests**, requests no GPS at startup, uses no background location watch, and stores no location history in settings or logs. Coordinates are plain-text note metadata. **Your vault's sync and backup services may copy this sensitive data**; the plugin does not encrypt it. Device location acquisition itself is provided by Obsidian and the OS, whose location services have their own privacy behavior.

## Development

Use Bun 1.3.10+ for package management and script execution. Commit `bun.lock`; use `bun install --frozen-lockfile` in CI.

```sh
bun install --frozen-lockfile
bun run dev          # esbuild watch (copy/link output to a disposable test vault)
bun run typecheck    # strict TypeScript, including tests
bun run test         # Vitest + Obsidian test mocks
bun run lint         # Oxlint (oxc) + Biome recommended checks
bun run format       # Biome formatting and safe fixes
bun run check        # lint + typecheck + production build + tests
```

`main.js` is a CommonJS bundle with `obsidian` externalized; no Node APIs are used at runtime. UI uses native Obsidian components and theme variables, without a web framework. The in-memory metadata index is updated incrementally; queries scan the notes and their locations. Core parsing, frontmatter rules, and queries are host-independent. `processFrontMatter()` owns YAML updates; a per-file queue serializes captures, and duplicate/invalid callbacks abort before serialization.

CI runs linting and typechecking as separate checks, tests on Linux/Windows/macOS, and a production build gated on all of them. It uploads the three installable files. The tagged-release workflow reuses these same checks and artifacts, then creates a **draft** GitHub release with notes extracted from [CHANGELOG.md](CHANGELOG.md), not an uncurated commit list. Only the release job has repository write permission.

### Changelog and releases

1. Add user-visible changes under `[Unreleased]` using Keep a Changelog categories (Added, Changed, Fixed, Removed, Security, etc.).
2. When preparing a release, move those entries to a dated heading such as `## [1.1.0] - 2026-10-20`. Keep `[Unreleased]` for future changes.
3. Set the same version in `package.json` and `manifest.json`. Add that version and its `minAppVersion` to `versions.json` for **every** release.
4. Run `bun run check`, complete the device acceptance checks, and preview notes with `bun run release:notes 1.1.0`.
5. Commit the release preparation, then push a tag named **exactly** `1.1.0` (no `v` prefix). The tag must point at that prepared commit. The workflow rejects mismatched versions, missing compatibility records, missing/duplicate changelog entries, and empty or undated notes.
6. Review the draft release's notes and its `main.js`, `manifest.json`, and `styles.css` attachments, then publish it manually.

Do not move published tags or rewrite released changelog entries; prepare a new patch release instead. A failed run before draft creation can be rerun; if a draft already exists, review it rather than overwriting it blindly. Branch CI runs only read-only checks; local checks never publish anything.

### Verification status

Automated tests cover schema integrity, precision/range parsing, duplicate boundaries, concurrent updates, target retention across note switches, unload safety, queries and sorting, GPS errors/age/accuracy/timeouts, settings validation, and live index changes. Desktop host checks use a disposable Linux Obsidian vault; simulated fixes test GPS-dependent behavior, **not real GPS hardware or permissions**.

Before publishing, run the [device acceptance checklist](docs/acceptance.md) on Android and iOS. Native mobile permission prompts, offline GPS behavior, real sync providers, and Windows/macOS remain device/manual checks, not claims made by the unit tests.
