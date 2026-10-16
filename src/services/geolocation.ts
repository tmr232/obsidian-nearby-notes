import { parseCoordinate } from "../core/coordinates";
import type { NearbySettings } from "../core/settings";
import type { LocationProvider, PositionFix } from "../types";

export class DeviceLocationProvider implements LocationProvider {
	constructor(
		private readonly settings: () => NearbySettings,
		private readonly isMobile: boolean,
		private readonly geolocation: Geolocation | undefined = globalThis.navigator
			?.geolocation,
	) {}

	async getCurrentPosition(): Promise<PositionFix> {
		const geo = this.geolocation;
		if (!this.isMobile || !geo)
			throw new Error("Device location is unavailable on this platform");
		const { gpsTimeoutMs, maximumGpsAccuracyMeters } = this.settings();
		const requestedAt = Date.now();
		return new Promise((resolve, reject) => {
			const timeoutMessage = `Couldn't obtain location within ${gpsTimeoutMs / 1000} seconds`;
			const timer = setTimeout(
				() => reject(new Error(timeoutMessage)),
				gpsTimeoutMs,
			);
			const fail = (message: string) => {
				clearTimeout(timer);
				reject(new Error(message));
			};
			try {
				geo.getCurrentPosition(
					(position) => {
						clearTimeout(timer);
						const coordinate = parseCoordinate([
							position.coords.latitude,
							position.coords.longitude,
						]);
						const accuracy = position.coords.accuracy;
						if (!coordinate) {
							fail("Device returned invalid coordinates");
							return;
						}
						if (
							!Number.isFinite(accuracy) ||
							accuracy < 0 ||
							accuracy > maximumGpsAccuracyMeters
						) {
							fail(`Location accuracy is too low (${Math.round(accuracy)} m)`);
							return;
						}
						// Small clock/bridge tolerance, but never accept an old cached reading.
						if (
							!Number.isFinite(position.timestamp) ||
							position.timestamp < requestedAt - 1000 ||
							position.timestamp > Date.now() + 1000
						) {
							fail("Device returned a stale or invalid location reading");
							return;
						}
						resolve({
							coordinate,
							accuracyMeters: accuracy,
							timestamp: position.timestamp,
						});
					},
					(error) =>
						fail(
							error.code === 1
								? "Location permission denied"
								: error.code === 3
									? timeoutMessage
									: "Couldn't obtain device location",
						),
					{ enableHighAccuracy: true, timeout: gpsTimeoutMs, maximumAge: 0 },
				);
			} catch {
				fail("Couldn't obtain device location");
			}
		});
	}
}
