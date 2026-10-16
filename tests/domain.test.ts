import { describe, expect, it } from "vitest";
import {
	distanceMeters,
	formatCoordinate,
	parseCoordinate,
} from "../src/core/coordinates";
import { appendLocation, readLocations } from "../src/core/frontmatter";
import { queryNearby } from "../src/core/query";
import {
	DEFAULT_SETTINGS,
	loadSettings,
	validateSettings,
} from "../src/core/settings";
import type { IndexedNote } from "../src/types";

const settings = { ...DEFAULT_SETTINGS };
const origin = { latitude: 0, longitude: 0 };

describe("coordinates", () => {
	it.each([" -32.0853, +34.7818 ", [-32.0853, 34.7818]])(
		"accepts decimal strings and legacy pairs: %j",
		(value) => {
			expect(parseCoordinate(value)).toEqual({
				latitude: -32.0853,
				longitude: 34.7818,
			});
		},
	);
	it.each([
		"",
		"1,",
		",2",
		"1,2,3",
		"0x10, 2",
		"91, 2",
		"1, -181",
		[1, Infinity],
		[NaN, 2],
		[false, 2],
		{},
		null,
	])("rejects malformed coordinates: %j", (value) => {
		expect(parseCoordinate(value)).toBeNull();
	});
	it("writes six places, accepts the poles, and measures across the antimeridian", () => {
		expect(formatCoordinate({ latitude: -32.0853, longitude: 34.7818 })).toBe(
			"-32.085300, 34.781800",
		);
		expect(parseCoordinate("90, -180")).toEqual({
			latitude: 90,
			longitude: -180,
		});
		expect(
			distanceMeters(
				{ latitude: 0, longitude: 179.999 },
				{ latitude: 0, longitude: -179.999 },
			),
		).toBeCloseTo(222.39, 2);
		expect(distanceMeters(origin, { latitude: 0, longitude: 180 })).toBeCloseTo(
			20_015_086.8,
			0,
		);
	});
});

describe("frontmatter contract", () => {
	it("initializes both fields, appends in order, and preserves the original and unrelated data", () => {
		const fm: Record<string, unknown> = { tags: ["travel"], rating: 4 };
		expect(appendLocation(fm, origin, settings).status).toBe("added");
		expect(
			appendLocation(fm, { latitude: 1, longitude: 2 }, settings).status,
		).toBe("added");
		expect(fm).toEqual({
			tags: ["travel"],
			rating: 4,
			location: "0.000000, 0.000000",
			locations: ["0.000000, 0.000000", "1.000000, 2.000000"],
		});
	});
	it.each([19, 21])(
		"deduplicates on the correct side of the 20 m boundary (%i m)",
		(meters) => {
			// Independently tabulated degrees of latitude per metre near the equator.
			const fm = { location: "0, 0" };
			const before = structuredClone(fm);
			const result = appendLocation(
				fm,
				{ latitude: meters / 111_195, longitude: 0 },
				settings,
			);
			expect(result.status).toBe(meters === 19 ? "duplicate" : "added");
			if (meters === 19) expect(fm).toEqual(before);
		},
	);
	it("does not round a candidate inside the duplicate radius before comparing", () => {
		const fm = { location: "0, 0" };
		// 19.46 m rounds to 0.0002 degrees (22.24 m) at four places.
		expect(
			appendLocation(
				fm,
				{ latitude: 0.000175, longitude: 0 },
				{ ...settings, coordinatePrecision: 4 },
			).status,
		).toBe("duplicate");
		expect(fm).toEqual({ location: "0, 0" });
	});
	it("uses unrounded candidates and checks both fields, even if the original is absent from history", () => {
		const fm = { location: "0, 0", locations: ["1, 1"] };
		expect(appendLocation(fm, origin, settings).status).toBe("duplicate");
		expect(readLocations(fm, settings).locations).toEqual([
			origin,
			{ latitude: 1, longitude: 1 },
		]);
		const precise = { latitude: 0.000004, longitude: 0 };
		expect(
			appendLocation(fm, precise, {
				...settings,
				duplicateRadiusMeters: 0,
				coordinatePrecision: 6,
			}).status,
		).toBe("added");
		expect(
			appendLocation(fm, precise, { ...settings, duplicateRadiusMeters: 0 })
				.status,
		).toBe("duplicate");
	});
	it.each([
		{ location: [1, 2] },
		{ location: [1, 2], locations: [] },
		{ locations: [[1, 2], "3, 4"] },
	])(
		"repairs incomplete fields without rewriting existing entries: %j",
		(initial) => {
			const fm: Record<string, unknown> = structuredClone(initial);
			expect(readLocations(fm, settings).original).toEqual({
				latitude: 1,
				longitude: 2,
			});
			appendLocation(fm, { latitude: 5, longitude: 6 }, settings);
			expect(fm.location).toEqual(
				"location" in initial ? initial.location : "1.000000, 2.000000",
			);
			expect(fm.locations).toEqual(
				"locations" in initial && initial.locations?.length
					? [...initial.locations, "5.000000, 6.000000"]
					: ["1.000000, 2.000000", "5.000000, 6.000000"],
			);
		},
	);
	it.each([
		{ location: "broken", locations: ["1, 2"] },
		{ locations: "1, 2" },
		{ location: "1, 2", locations: ["bad"] },
	])("rejects invalid properties without mutation: %j", (initial) => {
		const fm = structuredClone(initial);
		expect(readLocations(fm, settings).hasIssue).toBe(true);
		expect(() => appendLocation(fm, origin, settings)).toThrow(
			"invalid location properties",
		);
		expect(fm).toEqual(initial);
	});
	it("never invents an original when the explicit original or first history entry is invalid", () => {
		expect(
			readLocations({ location: "invalid", locations: ["1, 2"] }, settings)
				.original,
		).toBeNull();
		expect(
			readLocations({ locations: ["invalid", "1, 2"] }, settings).original,
		).toBeNull();
	});
});

describe("nearby query", () => {
	const note = (path: string, locations: string[]): IndexedNote => ({
		path,
		name: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
		...readLocations({ locations }, settings),
	});
	const notes = [
		note("Reference.md", ["0, 0", "50, 50"]),
		note("A.md", ["0.002, 0"]),
		note("B.md", ["1, 0", "0.001, 0"]),
		note("z.md", ["0.002, 0"]),
		note("folder/a.md", ["0.002, 0"]),
	];
	it("changes result order by mode, excludes the reference, and breaks ties by name then path", () => {
		expect(
			queryNearby(notes, origin, "original", {
				excludePath: "Reference.md",
			}).map((r) => r.note.path),
		).toEqual(["A.md", "folder/a.md", "z.md", "B.md"]);
		const nearest = queryNearby(notes, origin, "nearest", {
			excludePath: "Reference.md",
		});
		expect(nearest.map((r) => r.note.path)).toEqual([
			"B.md",
			"A.md",
			"folder/a.md",
			"z.md",
		]);
		expect(nearest[0]?.matchedCoordinate).toEqual({
			latitude: 0.001,
			longitude: 0,
		});
	});
	it("applies search and an inclusive maximum distance", () => {
		expect(
			queryNearby(notes, origin, "nearest", {
				excludePath: "Reference.md",
				maxDistanceMeters: 200,
			}).map((r) => r.note.path),
		).toEqual(["B.md"]);
		expect(
			queryNearby(notes, origin, "nearest", { search: "FOLDER/A" }).map(
				(r) => r.note.path,
			),
		).toEqual(["folder/a.md"]);
		expect(
			queryNearby(notes, origin, "nearest", { maxDistanceMeters: 0 }).map(
				(r) => r.note.path,
			),
		).toEqual(["Reference.md"]);
	});
	it("only includes valid history from metadata-issue notes in nearest mode", () => {
		const issue = {
			path: "issue.md",
			name: "issue",
			...readLocations({ location: "bad", locations: ["0, 0"] }, settings),
		};
		expect(queryNearby([issue], origin, "original")).toEqual([]);
		expect(queryNearby([issue], origin, "nearest")).toHaveLength(1);
	});
});

describe("settings", () => {
	it("rejects collisions and invalid numeric inputs, and safely loads damaged settings", () => {
		expect(
			loadSettings({
				originalLocationProperty: "locations",
				locationsProperty: "location",
			}),
		).toEqual({
			...settings,
			originalLocationProperty: "locations",
			locationsProperty: "location",
		});
		expect(
			validateSettings({ ...settings, locationsProperty: "location" }),
		).toBeTruthy();
		expect(
			validateSettings({ ...settings, duplicateRadiusMeters: NaN }),
		).toBeTruthy();
		expect(validateSettings({ ...settings, gpsTimeoutMs: 0 })).toBeTruthy();
		expect(
			loadSettings({
				originalLocationProperty: null,
				locationsProperty: 5,
				duplicateRadiusMeters: -1,
				distanceUnits: "imperial",
			}),
		).toEqual({ ...settings, distanceUnits: "imperial" });
	});
});
