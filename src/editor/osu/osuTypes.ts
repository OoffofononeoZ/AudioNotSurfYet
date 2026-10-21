export class OsuImportError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OsuImportError';
    }
}

export interface OsuTimingPoint {
    timeMs: number;
    beatLengthMs: number;
    meter: number;
    uninherited: boolean;
    kiai: boolean;
    line: number;
}

export interface OsuHitObject {
    kind: 'circle' | 'slider' | 'spinner' | 'hold';
    timeMs: number;
    endTimeMs: number;
    x: number;
    line: number;
}

export interface OsuBeatmap {
    formatVersion: 14;
    mode: 0 | 1 | 3;
    title: string;
    artist: string;
    creator: string;
    difficulty: string;
    audioFilename: string;
    columns: number;
    beatDivisor: number | null;
    timingPoints: OsuTimingPoint[];
    objects: OsuHitObject[];
    bookmarksMs: number[];
    breaks: Array<{ startMs: number; endMs: number }>;
}

export interface OsuControlPoint {
    timeMs: number;
    timing?: OsuTimingPoint;
    sliderVelocity: number;
    kiai: boolean;
}

export interface OsuImportOptions {
    notes: boolean;
    replaceTempo: boolean;
    bookmarks: boolean;
    breaks: boolean;
    kiai: boolean;
}

export const DEFAULT_OSU_IMPORT_OPTIONS: Readonly<OsuImportOptions> = {
    notes: true,
    replaceTempo: false,
    bookmarks: false,
    breaks: false,
    kiai: false,
};
