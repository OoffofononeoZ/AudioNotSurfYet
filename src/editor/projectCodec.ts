import { isFeatureId } from '../analysis/types';
import type {
    CreateEditorProjectInput,
    EditorLaneV1,
    EditorProjectV1,
    EditorTrackValidationContext,
    MeterDenominator,
    TempoSegmentV1,
} from './types';

const MICROSECOND = 1e-6;
const HASH_PATTERN = /^[a-f\d]{64}$/i;
const METER_DENOMINATORS = new Set<number>([1, 2, 4, 8, 16, 32]);
const BPM_SOURCES = new Set(['unset', 'estimated', 'user']);

type UnknownRecord = Record<string, unknown>;

export type EditorProjectValidationCode =
    | 'parse-failed'
    | 'invalid-schema'
    | 'unsupported-schema'
    | 'track-mismatch';

export class EditorProjectValidationError extends Error {
    readonly code: EditorProjectValidationCode;

    constructor(
        code: EditorProjectValidationCode,
        message: string,
    ) {
        super(message);
        this.name = 'EditorProjectValidationError';
        this.code = code;
    }
}

const invalid = (message: string): never => {
    throw new EditorProjectValidationError('invalid-schema', message);
};

const isRecord = (value: unknown): value is UnknownRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const assertRecord = (value: unknown, path: string): UnknownRecord => {
    if (!isRecord(value)) invalid(`${path} must be an object.`);
    return value as UnknownRecord;
};

const assertKeys = (
    value: UnknownRecord,
    required: readonly string[],
    optional: readonly string[] = [],
    path = 'value',
): void => {
    const allowed = new Set([...required, ...optional]);
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) invalid(`${path}.${key} is not supported.`);
    }
    for (const key of required) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
            invalid(`${path}.${key} is required.`);
        }
    }
};

const finite = (value: unknown, path: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        invalid(`${path} must be finite.`);
    }
    return value as number;
};

const text = (value: unknown, path: string, trim = false): string => {
    if (typeof value !== 'string' || (trim ? value.trim() : value).length === 0) {
        invalid(`${path} must be a non-empty string.`);
    }
    return value as string;
};

export const normalizeEditorSeconds = (value: number): number => {
    if (!Number.isFinite(value)) invalid('Editor seconds must be finite.');
    return Math.round(value * 1_000_000) / 1_000_000;
};

const isoTimestamp = (value: unknown, path: string): string => {
    const result = text(value, path);
    if (!Number.isFinite(Date.parse(result))) invalid(`${path} must be ISO time.`);
    return result;
};

const registerId = (ids: Set<string>, value: unknown, path: string): string => {
    const id = text(value, path, true);
    if (ids.has(id)) invalid(`${path} duplicates a project ID.`);
    ids.add(id);
    return id;
};

const canonicalTempo = (
    input: unknown,
    ids: Set<string>,
    duration: number,
    index: number,
): TempoSegmentV1 => {
    const path = `tempoMap[${index}]`;
    const value = assertRecord(input, path);
    const mode = value.mode;
    const id = registerId(ids, value.id, `${path}.id`);
    const startSeconds = normalizeEditorSeconds(finite(
        value.startSeconds,
        `${path}.startSeconds`,
    ));
    if (startSeconds < 0 || startSeconds >= duration && index > 0) {
        invalid(`${path}.startSeconds is outside the track.`);
    }
    if (mode === 'single-beat') {
        assertKeys(value, ['id', 'startSeconds', 'mode'], [], path);
        return { id, startSeconds, mode: 'single-beat' };
    }
    if (mode !== 'metered') invalid(`${path}.mode is invalid.`);
    assertKeys(value, [
        'id',
        'startSeconds',
        'mode',
        'bpm',
        'bpmSource',
        'meter',
    ], [], path);
    const bpmSource = value.bpmSource;
    if (typeof bpmSource !== 'string' || !BPM_SOURCES.has(bpmSource)) {
        invalid(`${path}.bpmSource is invalid.`);
    }
    let bpm: number | null = null;
    if (value.bpm !== null) {
        bpm = finite(value.bpm, `${path}.bpm`);
        if (bpm < 20 || bpm > 300) invalid(`${path}.bpm is outside 20–300.`);
    }
    if (
        (bpm === null && bpmSource !== 'unset')
        || (bpm !== null && bpmSource === 'unset')
    ) {
        invalid(`${path}.bpm and bpmSource disagree.`);
    }
    const meter = assertRecord(value.meter, `${path}.meter`);
    assertKeys(meter, ['numerator', 'denominator'], [], `${path}.meter`);
    const numerator = finite(meter.numerator, `${path}.meter.numerator`);
    const denominator = finite(
        meter.denominator,
        `${path}.meter.denominator`,
    );
    if (!Number.isInteger(numerator) || numerator < 1 || numerator > 32) {
        invalid(`${path}.meter.numerator is invalid.`);
    }
    if (!METER_DENOMINATORS.has(denominator)) {
        invalid(`${path}.meter.denominator is invalid.`);
    }
    return {
        id,
        startSeconds,
        mode: 'metered',
        bpm,
        bpmSource: bpmSource as 'unset' | 'estimated' | 'user',
        meter: {
            numerator,
            denominator: denominator as MeterDenominator,
        },
    };
};

const canonicalLane = (
    input: unknown,
    ids: Set<string>,
    duration: number,
    laneIndex: number,
): EditorLaneV1 => {
    const path = `lanes[${laneIndex}]`;
    const value = assertRecord(input, path);
    assertKeys(value, ['id', 'name', 'eventKind', 'innerClasses', 'events'], [], path);
    const id = registerId(ids, value.id, `${path}.id`);
    const name = text(value.name, `${path}.name`, true);
    if (!Array.isArray(value.innerClasses) || value.innerClasses.length === 0) {
        invalid(`${path}.innerClasses must not be empty.`);
    }
    const rawInnerClasses = value.innerClasses as unknown[];
    const innerClasses = rawInnerClasses.map((entry, index) => {
        const innerPath = `${path}.innerClasses[${index}]`;
        const inner = assertRecord(entry, innerPath);
        assertKeys(inner, ['id', 'label'], [], innerPath);
        return {
            id: registerId(ids, inner.id, `${innerPath}.id`),
            label: text(inner.label, `${innerPath}.label`, true),
        };
    });
    const innerIds = new Set(innerClasses.map((entry) => entry.id));
    if (!Array.isArray(value.events)) invalid(`${path}.events must be an array.`);

    if (value.eventKind === 'point') {
        const uniqueness = new Set<string>();
        const rawEvents = value.events as unknown[];
        const events = rawEvents.map((entry, index) => {
            const eventPath = `${path}.events[${index}]`;
            const event = assertRecord(entry, eventPath);
            assertKeys(event, ['id', 'innerClassId', 'atSeconds'], [], eventPath);
            const eventId = registerId(ids, event.id, `${eventPath}.id`);
            const innerClassId = text(
                event.innerClassId,
                `${eventPath}.innerClassId`,
                true,
            );
            if (!innerIds.has(innerClassId)) invalid(`${eventPath} has a dangling inner class.`);
            const atSeconds = normalizeEditorSeconds(finite(
                event.atSeconds,
                `${eventPath}.atSeconds`,
            ));
            if (atSeconds < 0 || atSeconds > duration) {
                invalid(`${eventPath}.atSeconds is outside the track.`);
            }
            const key = `${innerClassId}\0${atSeconds}`;
            if (uniqueness.has(key)) invalid(`${eventPath} duplicates a point.`);
            uniqueness.add(key);
            return { id: eventId, innerClassId, atSeconds };
        }).sort((left, right) =>
            left.atSeconds - right.atSeconds || left.id.localeCompare(right.id));
        return { id, name, eventKind: 'point', innerClasses, events };
    }
    if (value.eventKind !== 'range') invalid(`${path}.eventKind is invalid.`);
    const rawEvents = value.events as unknown[];
    const events = rawEvents.map((entry, index) => {
        const eventPath = `${path}.events[${index}]`;
        const event = assertRecord(entry, eventPath);
        assertKeys(event, [
            'id',
            'innerClassId',
            'startSeconds',
            'endSeconds',
        ], [], eventPath);
        const eventId = registerId(ids, event.id, `${eventPath}.id`);
        const innerClassId = text(
            event.innerClassId,
            `${eventPath}.innerClassId`,
            true,
        );
        if (!innerIds.has(innerClassId)) invalid(`${eventPath} has a dangling inner class.`);
        const startSeconds = normalizeEditorSeconds(finite(
            event.startSeconds,
            `${eventPath}.startSeconds`,
        ));
        const endSeconds = normalizeEditorSeconds(finite(
            event.endSeconds,
            `${eventPath}.endSeconds`,
        ));
        if (startSeconds < 0 || endSeconds > duration || startSeconds >= endSeconds) {
            invalid(`${eventPath} is outside the track or collapsed.`);
        }
        return { id: eventId, innerClassId, startSeconds, endSeconds };
    }).sort((left, right) =>
        left.startSeconds - right.startSeconds
        || left.endSeconds - right.endSeconds
        || left.id.localeCompare(right.id));
    const byInnerClass = new Map<string, typeof events>();
    for (const event of events) {
        const group = byInnerClass.get(event.innerClassId) ?? [];
        const previous = group[group.length - 1];
        if (previous && event.startSeconds < previous.endSeconds) {
            invalid(`${path}.events overlap within one inner class.`);
        }
        group.push(event);
        byInnerClass.set(event.innerClassId, group);
    }
    return { id, name, eventKind: 'range', innerClasses, events };
};

export const validateEditorProjectV1 = (
    input: unknown,
    trackContext?: EditorTrackValidationContext,
): EditorProjectV1 => {
    const value = assertRecord(input, 'project');
    if (value.format !== 'audiosurf-editor' || value.schemaVersion !== 1) {
        if (value.schemaVersion !== 1) {
            throw new EditorProjectValidationError(
                'unsupported-schema',
                `Unsupported Editor schema: ${String(value.schemaVersion)}.`,
            );
        }
        invalid('Editor project format is invalid.');
    }
    assertKeys(value, [
        'format',
        'schemaVersion',
        'projectId',
        'createdAt',
        'updatedAt',
        'track',
        'tempoMap',
        'lanes',
        'workspace',
    ], [], 'project');
    const ids = new Set<string>();
    const projectId = registerId(ids, value.projectId, 'project.projectId');
    const createdAt = isoTimestamp(value.createdAt, 'project.createdAt');
    const updatedAt = isoTimestamp(value.updatedAt, 'project.updatedAt');
    if (Date.parse(updatedAt) < Date.parse(createdAt)) {
        invalid('project.updatedAt precedes createdAt.');
    }
    const track = assertRecord(value.track, 'project.track');
    assertKeys(track, [
        'contentHash',
        'fileName',
        'durationSeconds',
    ], ['title', 'artist', 'sampleRate'], 'project.track');
    const contentHash = text(track.contentHash, 'project.track.contentHash');
    if (!HASH_PATTERN.test(contentHash)) invalid('project.track.contentHash is not SHA-256.');
    const durationSeconds = normalizeEditorSeconds(finite(
        track.durationSeconds,
        'project.track.durationSeconds',
    ));
    if (durationSeconds <= 0) invalid('project.track.durationSeconds must be positive.');
    let sampleRate: number | undefined;
    if (track.sampleRate !== undefined) {
        sampleRate = finite(track.sampleRate, 'project.track.sampleRate');
        if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
            invalid('project.track.sampleRate must be a positive integer.');
        }
    }
    if (trackContext) {
        const tolerance = Math.max(MICROSECOND, 1 / trackContext.sampleRate);
        if (
            contentHash !== trackContext.contentHash
            || Math.abs(durationSeconds - trackContext.durationSeconds) > tolerance
        ) {
            throw new EditorProjectValidationError(
                'track-mismatch',
                'Editor project belongs to another track.',
            );
        }
    }
    if (!Array.isArray(value.tempoMap) || value.tempoMap.length === 0) {
        invalid('project.tempoMap must not be empty.');
    }
    const rawTempoMap = value.tempoMap as unknown[];
    const tempoMap = rawTempoMap.map((entry, index) =>
        canonicalTempo(entry, ids, durationSeconds, index))
        .sort((left, right) => left.startSeconds - right.startSeconds);
    if (Math.abs(tempoMap[0]!.startSeconds) > MICROSECOND) {
        invalid('project.tempoMap must start at zero.');
    }
    for (let index = 1; index < tempoMap.length; index += 1) {
        if (tempoMap[index]!.startSeconds <= tempoMap[index - 1]!.startSeconds) {
            invalid('project.tempoMap must be strictly increasing.');
        }
    }
    if (!Array.isArray(value.lanes)) invalid('project.lanes must be an array.');
    const rawLanes = value.lanes as unknown[];
    const lanes = rawLanes.map((entry, index) =>
        canonicalLane(entry, ids, durationSeconds, index));
    const workspace = assertRecord(value.workspace, 'project.workspace');
    assertKeys(workspace, ['viewport', 'overlay'], [], 'project.workspace');
    const viewport = assertRecord(workspace.viewport, 'project.workspace.viewport');
    assertKeys(viewport, ['startSeconds', 'endSeconds', 'zoom'], [], 'project.workspace.viewport');
    const startSeconds = normalizeEditorSeconds(finite(
        viewport.startSeconds,
        'project.workspace.viewport.startSeconds',
    ));
    const endSeconds = normalizeEditorSeconds(finite(
        viewport.endSeconds,
        'project.workspace.viewport.endSeconds',
    ));
    const zoom = finite(viewport.zoom, 'project.workspace.viewport.zoom');
    if (startSeconds < 0 || startSeconds >= endSeconds || endSeconds > durationSeconds || zoom <= 0) {
        invalid('project.workspace.viewport is invalid.');
    }
    const overlay = assertRecord(workspace.overlay, 'project.workspace.overlay');
    assertKeys(overlay, ['featureId', 'topRatio', 'heightRatio'], [], 'project.workspace.overlay');
    const featureId = overlay.featureId;
    if (featureId !== null && !isFeatureId(featureId)) {
        invalid('project.workspace.overlay.featureId is invalid.');
    }
    const topRatio = finite(overlay.topRatio, 'project.workspace.overlay.topRatio');
    const heightRatio = finite(
        overlay.heightRatio,
        'project.workspace.overlay.heightRatio',
    );
    if (
        topRatio < 0
        || topRatio >= 1
        || heightRatio <= 0
        || heightRatio > 1
        || topRatio + heightRatio > 1 + Number.EPSILON
    ) {
        invalid('project.workspace.overlay bounds are invalid.');
    }
    return {
        format: 'audiosurf-editor',
        schemaVersion: 1,
        projectId,
        createdAt,
        updatedAt,
        track: {
            contentHash,
            fileName: text(track.fileName, 'project.track.fileName', true),
            ...(track.title === undefined
                ? {}
                : { title: text(track.title, 'project.track.title') }),
            ...(track.artist === undefined
                ? {}
                : { artist: text(track.artist, 'project.track.artist') }),
            durationSeconds,
            ...(sampleRate === undefined ? {} : { sampleRate }),
        },
        tempoMap,
        lanes,
        workspace: {
            viewport: { startSeconds, endSeconds, zoom },
            overlay: {
                featureId: featureId as EditorProjectV1['workspace']['overlay']['featureId'],
                topRatio,
                heightRatio,
            },
        },
    };
};

export const encodeEditorProjectV1 = (project: EditorProjectV1): Uint8Array =>
    new TextEncoder().encode(
        `${JSON.stringify(validateEditorProjectV1(project), null, 2)}\n`,
    );

export const decodeEditorProjectV1 = (
    input: ArrayBuffer | Uint8Array | string,
    context?: EditorTrackValidationContext,
): EditorProjectV1 => {
    let parsed: unknown;
    try {
        const source = typeof input === 'string'
            ? input
            : new TextDecoder('utf-8', { fatal: true }).decode(input);
        parsed = JSON.parse(source) as unknown;
    } catch (error) {
        throw new EditorProjectValidationError(
            'parse-failed',
            error instanceof Error ? error.message : 'Editor JSON parse failed.',
        );
    }
    return validateEditorProjectV1(parsed, context);
};

export const createInitialEditorProject = ({
    track,
    createId = () => crypto.randomUUID(),
    now = () => new Date(),
}: CreateEditorProjectInput): EditorProjectV1 => {
    const timestamp = now().toISOString();
    return validateEditorProjectV1({
        format: 'audiosurf-editor',
        schemaVersion: 1,
        projectId: createId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        track,
        tempoMap: [{
            id: createId(),
            startSeconds: 0,
            mode: 'metered',
            bpm: null,
            bpmSource: 'unset',
            meter: { numerator: 4, denominator: 4 },
        }],
        lanes: [],
        workspace: {
            viewport: {
                startSeconds: 0,
                endSeconds: track.durationSeconds,
                zoom: 1,
            },
            overlay: {
                featureId: null,
                topRatio: 0.10,
                heightRatio: 0.35,
            },
        },
    });
};

export interface EditorFormatCodec {
    id: 'json-v1';
    label: 'JSON';
    extension: '.audiosurf-editor.json';
    mimeType: 'application/json';
    encode(project: EditorProjectV1): Uint8Array;
    decode(
        input: ArrayBuffer | Uint8Array | string,
        context?: EditorTrackValidationContext,
    ): EditorProjectV1;
}

export class EditorFormatCodecRegistry {
    private readonly codecs = new Map<string, EditorFormatCodec>();

    constructor(codecs: readonly EditorFormatCodec[] = [JSON_V1_CODEC]) {
        for (const codec of codecs) {
            if (this.codecs.has(codec.id)) throw new Error(`Duplicate codec: ${codec.id}`);
            this.codecs.set(codec.id, codec);
        }
    }

    list(): readonly EditorFormatCodec[] {
        return [...this.codecs.values()];
    }

    get(id: string): EditorFormatCodec {
        const codec = this.codecs.get(id);
        if (!codec) throw new Error(`Unknown Editor codec: ${id}`);
        return codec;
    }
}

export const JSON_V1_CODEC: EditorFormatCodec = {
    id: 'json-v1',
    label: 'JSON',
    extension: '.audiosurf-editor.json',
    mimeType: 'application/json',
    encode: encodeEditorProjectV1,
    decode: decodeEditorProjectV1,
};
