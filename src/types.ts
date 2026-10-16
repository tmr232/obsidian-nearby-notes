export interface Coordinate {
	latitude: number;
	longitude: number;
}

export type DistanceMode = "original" | "nearest";

export interface PositionFix {
	coordinate: Coordinate;
	accuracyMeters: number;
	timestamp: number;
}

export interface LocationProvider {
	getCurrentPosition(): Promise<PositionFix>;
}

export interface IndexedNote {
	path: string;
	name: string;
	original: Coordinate | null;
	locations: Coordinate[];
	hasIssue: boolean;
}

export interface NearbyResult {
	note: IndexedNote;
	distanceMeters: number;
	matchedCoordinate: Coordinate;
}
