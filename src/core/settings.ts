import type { DistanceMode } from "../types";

export interface NearbySettings {
	originalLocationProperty: string;
	locationsProperty: string;
	duplicateRadiusMeters: number;
	coordinatePrecision: number;
	gpsTimeoutMs: number;
	maximumGpsAccuracyMeters: number;
	distanceUnits: "metric" | "imperial";
	defaultDistanceMode: DistanceMode;
	defaultMaxDistanceMeters: number | null;
	showCaptureNotices: boolean;
}

export const DEFAULT_SETTINGS: NearbySettings = {
	originalLocationProperty: "location",
	locationsProperty: "locations",
	duplicateRadiusMeters: 20,
	coordinatePrecision: 6,
	gpsTimeoutMs: 15_000,
	maximumGpsAccuracyMeters: 100,
	distanceUnits: "metric",
	defaultDistanceMode: "nearest",
	defaultMaxDistanceMeters: null,
	showCaptureNotices: true,
};

export function validateSettings(settings: NearbySettings): string | null {
	const names = [settings.originalLocationProperty, settings.locationsProperty];
	if (
		names.some(
			(name) =>
				typeof name !== "string" ||
				!name.trim() ||
				name !== name.trim() ||
				/[\n\r]/.test(name) ||
				name.includes(String.fromCharCode(0)) ||
				["__proto__", "constructor", "prototype", "position"].includes(name),
		)
	)
		return "Use nonempty property names without surrounding whitespace or reserved names.";
	if (names[0] === names[1])
		return "Location property names must be different.";
	if (
		!Number.isFinite(settings.duplicateRadiusMeters) ||
		settings.duplicateRadiusMeters < 0
	)
		return "Duplicate radius must be zero or greater.";
	if (
		!Number.isInteger(settings.coordinatePrecision) ||
		settings.coordinatePrecision < 0 ||
		settings.coordinatePrecision > 10
	)
		return "Coordinate precision must be an integer from 0 to 10.";
	if (
		!Number.isInteger(settings.gpsTimeoutMs) ||
		settings.gpsTimeoutMs < 1000 ||
		settings.gpsTimeoutMs > 120_000
	)
		return "GPS timeout must be between 1,000 and 120,000 milliseconds.";
	if (
		!Number.isFinite(settings.maximumGpsAccuracyMeters) ||
		settings.maximumGpsAccuracyMeters <= 0
	)
		return "Maximum GPS accuracy must be greater than zero.";
	if (
		settings.defaultMaxDistanceMeters !== null &&
		(!Number.isFinite(settings.defaultMaxDistanceMeters) ||
			settings.defaultMaxDistanceMeters < 0)
	)
		return "Maximum distance must be zero or greater, or empty for all distances.";
	if (
		!["metric", "imperial"].includes(settings.distanceUnits) ||
		!["nearest", "original"].includes(settings.defaultDistanceMode) ||
		typeof settings.showCaptureNotices !== "boolean"
	)
		return "Invalid display settings.";
	return null;
}

export function loadSettings(data: unknown): NearbySettings {
	const settings = { ...DEFAULT_SETTINGS };
	if (!data || typeof data !== "object") return settings;
	const saved = data as Record<string, unknown>;
	// Validate names together so a valid pair can reuse either default name.
	const names = {
		...settings,
		originalLocationProperty: Object.hasOwn(saved, "originalLocationProperty")
			? (saved.originalLocationProperty as string)
			: settings.originalLocationProperty,
		locationsProperty: Object.hasOwn(saved, "locationsProperty")
			? (saved.locationsProperty as string)
			: settings.locationsProperty,
	};
	if (!validateSettings(names)) Object.assign(settings, names);
	for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof NearbySettings)[]) {
		if (!Object.hasOwn(data, key)) continue;
		const candidate = {
			...settings,
			[key]: saved[key],
		};
		if (!validateSettings(candidate)) Object.assign(settings, candidate);
	}
	return settings;
}
