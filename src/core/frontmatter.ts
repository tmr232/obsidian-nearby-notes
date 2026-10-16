import type { Coordinate, IndexedNote } from "../types";
import {
	distanceMeters,
	formatCoordinate,
	parseCoordinate,
} from "./coordinates";
import type { NearbySettings } from "./settings";

type PropertyNames = Pick<
	NearbySettings,
	"originalLocationProperty" | "locationsProperty"
>;

export function readLocations(
	frontmatter: Record<string, unknown>,
	properties: PropertyNames,
): Omit<IndexedNote, "path" | "name"> {
	const hasOriginal = Object.hasOwn(
		frontmatter,
		properties.originalLocationProperty,
	);
	const hasList = Object.hasOwn(frontmatter, properties.locationsProperty);
	const rawOriginal = frontmatter[properties.originalLocationProperty];
	const rawList = frontmatter[properties.locationsProperty];
	const parsedOriginal = parseCoordinate(rawOriginal);
	const list = Array.isArray(rawList) ? rawList.map(parseCoordinate) : [];
	const validList = list.filter((point): point is Coordinate => point !== null);
	// An invalid explicit original must not silently become a different original.
	const original = hasOriginal ? parsedOriginal : (list[0] ?? null);
	const locations = [...validList];
	if (
		parsedOriginal &&
		!locations.some(
			(point) =>
				point.latitude === parsedOriginal.latitude &&
				point.longitude === parsedOriginal.longitude,
		)
	)
		locations.unshift(parsedOriginal);
	return {
		original,
		locations,
		hasIssue:
			(hasOriginal && !parsedOriginal) ||
			(hasList && (!Array.isArray(rawList) || list.some((point) => !point))),
	};
}

export class InvalidLocationProperties extends Error {
	constructor() {
		super("Couldn't update location: invalid location properties");
	}
}

export type AddLocationResult =
	| { status: "added" }
	| { status: "duplicate"; distanceMeters: number };

export function appendLocation(
	frontmatter: Record<string, unknown>,
	candidate: Coordinate,
	settings: NearbySettings,
): AddLocationResult {
	if (!parseCoordinate([candidate.latitude, candidate.longitude]))
		throw new Error("Invalid coordinates");
	const current = readLocations(frontmatter, settings);
	if (current.hasIssue) throw new InvalidLocationProperties();
	const closest = Math.min(
		...current.locations.map((point) => distanceMeters(point, candidate)),
	);
	if (closest <= settings.duplicateRadiusMeters)
		return { status: "duplicate", distanceMeters: closest };
	const formatted = formatCoordinate(candidate, settings.coordinatePrecision);
	const originalKey = settings.originalLocationProperty;
	const listKey = settings.locationsProperty;
	const existingList = frontmatter[listKey];
	const nextList: unknown[] = Array.isArray(existingList)
		? [...existingList]
		: [];
	if (nextList.length === 0 && current.original)
		nextList.push(
			formatCoordinate(current.original, settings.coordinatePrecision),
		);
	if (!Object.hasOwn(frontmatter, originalKey))
		frontmatter[originalKey] = current.original
			? formatCoordinate(current.original, settings.coordinatePrecision)
			: formatted;
	nextList.push(formatted);
	frontmatter[listKey] = nextList;
	return { status: "added" };
}
