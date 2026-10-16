import type {
	Coordinate,
	DistanceMode,
	IndexedNote,
	NearbyResult,
} from "../types";
import { distanceMeters } from "./coordinates";

export function queryNearby(
	notes: Iterable<IndexedNote>,
	reference: Coordinate,
	mode: DistanceMode,
	options: {
		excludePath?: string;
		search?: string;
		maxDistanceMeters?: number | null;
	} = {},
): NearbyResult[] {
	const results: NearbyResult[] = [];
	const search = options.search?.trim().toLowerCase() ?? "";
	for (const note of notes) {
		if (
			note.path === options.excludePath ||
			!note.path.toLowerCase().includes(search)
		)
			continue;
		const points =
			mode === "original"
				? note.original
					? [note.original]
					: []
				: note.locations;
		let best: NearbyResult | undefined;
		for (const point of points) {
			const distance = distanceMeters(reference, point);
			if (!best || distance < best.distanceMeters)
				best = { note, distanceMeters: distance, matchedCoordinate: point };
		}
		if (
			best &&
			(options.maxDistanceMeters == null ||
				best.distanceMeters <= options.maxDistanceMeters)
		)
			results.push(best);
	}
	return results.sort(
		(a, b) =>
			a.distanceMeters - b.distanceMeters ||
			compare(a.note.name.toLowerCase(), b.note.name.toLowerCase()) ||
			compare(a.note.path, b.note.path),
	);
}

function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}
