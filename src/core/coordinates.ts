import type { Coordinate } from "../types";

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function parseCoordinate(value: unknown): Coordinate | null {
	const parts: unknown[] =
		typeof value === "string"
			? value.split(",")
			: Array.isArray(value)
				? value
				: [];
	if (parts.length !== 2) return null;
	const numbers = parts.map((part) => {
		if (typeof part === "number") return part;
		if (typeof part === "string" && DECIMAL.test(part.trim()))
			return Number(part.trim());
		return Number.NaN;
	});
	const [latitude, longitude] = numbers;
	if (
		latitude === undefined ||
		longitude === undefined ||
		!Number.isFinite(latitude) ||
		!Number.isFinite(longitude) ||
		Math.abs(latitude) > 90 ||
		Math.abs(longitude) > 180
	)
		return null;
	return { latitude, longitude };
}

export function formatCoordinate(
	coordinate: Coordinate,
	precision = 6,
): string {
	return `${coordinate.latitude.toFixed(precision)}, ${coordinate.longitude.toFixed(precision)}`;
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
	const radians = Math.PI / 180;
	const lat = (b.latitude - a.latitude) * radians;
	const lon = (b.longitude - a.longitude) * radians;
	const h =
		Math.sin(lat / 2) ** 2 +
		Math.cos(a.latitude * radians) *
			Math.cos(b.latitude * radians) *
			Math.sin(lon / 2) ** 2;
	return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function formatDistance(
	meters: number,
	units: "metric" | "imperial",
): string {
	if (units === "imperial") {
		const feet = meters / 0.3048;
		return feet < 5280
			? `${Math.round(feet)} ft`
			: `${(feet / 5280).toFixed(1)} mi`;
	}
	return meters < 1000
		? `${Math.round(meters)} m`
		: `${(meters / 1000).toFixed(1)} km`;
}
