import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { DeviceLocationProvider } from "../src/services/geolocation";

afterEach(() => vi.useRealTimers());

function geo(
	fix: Partial<{
		latitude: number;
		longitude: number;
		accuracy: number;
		timestamp: number;
	}> = {},
): Geolocation {
	return {
		getCurrentPosition: (success) =>
			success({
				coords: {
					latitude: 32,
					longitude: 34,
					accuracy: 8,
					altitude: null,
					altitudeAccuracy: null,
					heading: null,
					speed: null,
					toJSON: () => ({}),
					...fix,
				},
				timestamp: fix.timestamp ?? Date.now(),
				toJSON: () => ({}),
			}),
		watchPosition: () => {
			throw new Error("Must not track location");
		},
		clearWatch: () => {},
	};
}

describe("one-shot GPS", () => {
	it("accepts a fresh accurate fix and requests high accuracy with no cached position", async () => {
		const device = geo();
		const get = vi.spyOn(device, "getCurrentPosition");
		const fix = await new DeviceLocationProvider(
			() => DEFAULT_SETTINGS,
			true,
			device,
		).getCurrentPosition();
		expect(fix.coordinate).toEqual({ latitude: 32, longitude: 34 });
		expect(fix.accuracyMeters).toBe(8);
		expect(get.mock.calls[0]?.[2]).toEqual({
			enableHighAccuracy: true,
			maximumAge: 0,
			timeout: 15000,
		});
	});
	it.each([
		{ accuracy: 101 },
		{ accuracy: -1 },
		{ accuracy: NaN },
		{ latitude: 91 },
		{ timestamp: Date.now() - 60_000 },
		{ timestamp: NaN },
		{ timestamp: Date.now() + 60_000 },
	])("rejects unsafe readings: %j", async (fix) => {
		await expect(
			new DeviceLocationProvider(
				() => DEFAULT_SETTINGS,
				true,
				geo(fix),
			).getCurrentPosition(),
		).rejects.toThrow();
	});
	it("rejects unsupported desktops without invoking a GPS provider", async () => {
		const device = geo();
		const get = vi.spyOn(device, "getCurrentPosition");
		await expect(
			new DeviceLocationProvider(
				() => DEFAULT_SETTINGS,
				false,
				device,
			).getCurrentPosition(),
		).rejects.toThrow("unavailable on this platform");
		expect(get).not.toHaveBeenCalled();
	});
	it.each([
		[1, "permission denied"],
		[2, "Couldn't obtain device location"],
		[3, "within 15 seconds"],
	] as const)("normalizes platform error %i", async (code, message) => {
		const device = geo();
		device.getCurrentPosition = (_success, failure) =>
			failure?.({
				code,
				message: "Native detail",
				PERMISSION_DENIED: 1,
				POSITION_UNAVAILABLE: 2,
				TIMEOUT: 3,
			});
		await expect(
			new DeviceLocationProvider(
				() => DEFAULT_SETTINGS,
				true,
				device,
			).getCurrentPosition(),
		).rejects.toThrow(message);
	});
	it("times out even when the host never calls back", async () => {
		vi.useFakeTimers();
		const device = geo();
		device.getCurrentPosition = () => {};
		const pending = new DeviceLocationProvider(
			() => DEFAULT_SETTINGS,
			true,
			device,
		).getCurrentPosition();
		const assertion = expect(pending).rejects.toThrow("within 15 seconds");
		await vi.advanceTimersByTimeAsync(15_000);
		await assertion;
	});
});
