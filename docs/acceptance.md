# Device acceptance checklist

Use a backed-up or disposable vault and Obsidian 1.11+. Record the app version, OS version, and result for each device. Android, iOS, Windows, macOS, and Linux should each have their own run. GPS steps apply only to mobile.

## Mobile GPS — Android and iOS (not yet device-verified)

- [ ] Enable plugin and restore workspace: no permission prompt or GPS request.
- [ ] Open Markdown note; tap ribbon; approve permission; both properties contain a fresh coordinate string.
- [ ] Deny permission: clear notice, no note changes. Restore permission through OS settings and retry.
- [ ] Capture at the same place twice: duplicate notice, note bytes and modification time unchanged.
- [ ] Move beyond duplicate radius and capture: original unchanged; history appended in order.
- [ ] Capture then switch notes during acquisition: only the original target changes.
- [ ] Trigger two captures rapidly: no duplicate append.
- [ ] Disable plugin or delete target during acquisition: no unexpected note writes.
- [ ] Poor accuracy, stale reading, timeout: notice and no metadata modifications.
- [ ] Disable internet and repeat capture; allow extra time for an uncached offline fix. The plugin requires no network, but the OS may fail to obtain a fix indoors.
- [ ] Copy coordinates command puts only a formatted pair on the clipboard.
- [ ] Native Properties renders original as text and history as a list.

## Browser and lifecycle — all platforms

- [ ] Newly opened/restored view starts with Controls collapsed and no introductory tagline; results and the active-query summary remain visible.
- [ ] Expand/collapse Controls with pointer and keyboard; changing the query or choosing a note does not unexpectedly close Controls. Collapsing retains filters and sorted results.
- [ ] Use note reference with three recorded locations: reference always uses first.
- [ ] Original and Nearest modes produce different expected ordering for a result with a distant original and a nearby later point.
- [ ] Reference note excluded; notes without coordinates excluded; equal-distance ties deterministic.
- [ ] 500 m filter excludes points outside 500 m; Custom accepts zero and rejects negative/empty inputs.
- [ ] Search names/paths; selecting a result opens correct editor note, retaining sidebar query.
- [ ] Use keyboard to choose reference, change filters, search, and open results; visible focus and readable labels.
- [ ] Rename reference/result note and its containing folder: reference follows file, result paths update.
- [ ] Delete reference: explanatory message; delete result: disappears.
- [ ] Manually edit Properties or raw frontmatter: results update.
- [ ] Make equivalent changes through actual vault sync, including conflicts/deletions; verify the resulting source-of-truth metadata and ordering.
- [ ] Change property names in settings: reindex immediately, no vault migration.
- [ ] Malformed original/history: warning, no capture write; original never replaced with a later point.
- [ ] Restart: note-reference query restored; no persisted GPS history or implicit GPS request.
- [ ] Unload/reload: no duplicate listeners, orphan views, or late writes.
- [ ] Test light/dark themes, narrow sidebar, long filenames, and settings layout.

## GPS reference — mobile

- [ ] Run Open nearby-notes browser: a single fresh fix populates distance-sorted results without expanding Controls. Restoring the workspace never requests GPS.
- [ ] Selecting Current position acquires once, not continuously.
- [ ] Refresh updates acquisition time and coordinates.
- [ ] Failed refresh keeps previous coordinates/results with a visible stale-position warning and error, even when Controls is collapsed.
- [ ] Closing/reopening or restarting requires a new explicit GPS action, never stored coordinates.

## Release

- [ ] `bun install --frozen-lockfile && bun run check` succeeds.
- [ ] Install only main.js, manifest.json, styles.css into a clean vault.
- [ ] Review manifest/version/tag compatibility and privacy documentation.
- [ ] Complete real mobile GPS checks above before declaring mobile integration verified.
