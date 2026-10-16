# Changelog

All notable changes to Nearby Notes are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Version headings must match the plugin version and release tag exactly.

## [Unreleased]

## [1.0.0] - 2026-10-16

### Added

- One-tap mobile location capture with configurable accuracy, timeout, precision, and duplicate radius.
- Original-location preservation and ordered location history in Markdown frontmatter.
- Nearby Notes sidebar with note/GPS references, Original/Nearest distance modes, search, distance limits, and metric/imperial display.
- Collapsed-by-default controls with an active-query summary, visible GPS warnings, and a fresh position when explicitly opening the browser on mobile.
- Desktop proximity browsing without GPS or network access.
- Commands to capture a location, open nearby notes, browse near the active note, and copy coordinates.
- Incremental metadata indexing, rename/deletion handling, metadata-issue warnings, and stale GPS reference indicators.
- Validated settings and workspace query restoration without persisting GPS coordinates.
- Bun development workflow, strict TypeScript, Oxlint, Biome, automated tests, and CI release packaging.

### Security

- No plugin network requests, telemetry, background tracking, startup GPS requests, or location history in settings/logs.
- Malformed location properties and failed/uncertain GPS readings do not overwrite note metadata.
- Duplicate captures abort without rewriting note contents.

### Known limitations

- Android/iOS GPS hardware and permission flows have not yet been verified on real devices. This initial release is a prerelease for testing, not a claim of verified mobile integration.
- Maps, geocoding, automatic migrations, and bulk metadata repair are intentionally not included.
