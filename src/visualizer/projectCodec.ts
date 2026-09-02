import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import { isFeatureId, type FeatureId } from '../analysis/types';
import { validateEditorProjectV1 } from '../editor/projectCodec';
import type { EditorTrackIdentityV1 } from '../editor/types';
import {
    SceneRegistry,
    type SceneNumericRange,
    type SceneParameterDescriptor,
    type SceneTemplateDescriptor,
} from './sceneRegistry';
import type {
    VisualizerAnalysisComponent,
    VisualizerAnalysisProjectionV1,
    VisualizerBindingSourceV1,
    VisualizerNumericTransformV1,
    VisualizerParameterBindingV1,
    VisualizerProjectV1,
    VisualizerTemplateId,
    VisualizerTrackValidationContext,
} from './types';

const HASH_PATTERN = /^[a-f\d]{64}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MICROSECOND = 1e-6;
const COMPONENTS = new Set<VisualizerAnalysisComponent>([
    'default', 'total', 'specific', 'real', 'imag', 'magnitude', 'phase',
]);
type UnknownRecord = Record<string, unknown>;

export type VisualizerProjectValidationCode =
    | 'parse-failed'
    | 'invalid-schema'
    | 'unsupported-schema'
    | 'track-mismatch'
    | 'analysis-feature-limit';

export class VisualizerProjectValidationError extends Error {
    readonly code: VisualizerProjectValidationCode;

    constructor(code: VisualizerProjectValidationCode, message: string) {
        super(message);
        this.name = 'VisualizerProjectValidationError';
        this.code = code;
    }
}

const invalid = (message: string): never => {
    throw new VisualizerProjectValidationError('invalid-schema', message);
};

const isRecord = (value: unknown): value is UnknownRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const record = (value: unknown, path: string): UnknownRecord => {
    if (!isRecord(value)) invalid(`${path} must be an object.`);
    return value as UnknownRecord;
};

const keys = (
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
    if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0)) {
        invalid(`${path} must be a finite number other than -0.`);
    }
    return value as number;
};

const integer = (value: unknown, path: string): number => {
    const result = finite(value, path);
    if (!Number.isInteger(result)) invalid(`${path} must be an integer.`);
    return result;
};

const assertInRange = (
    value: number,
    range: SceneNumericRange,
    path: string,
): void => {
    if (value < range.min || value > range.max) {
        invalid(`${path} must be between ${range.min} and ${range.max}.`);
    }
    if (range.integer && !Number.isInteger(value)) {
        invalid(`${path} must be an integer.`);
    }
};

const text = (value: unknown, path: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        invalid(`${path} must be a non-empty string.`);
    }
    return value as string;
};

const iso = (value: unknown, path: string): string => {
    const result = text(value, path);
    if (!Number.isFinite(Date.parse(result))) invalid(`${path} must be ISO time.`);
    return result;
};

const canonicalTrack = (
    input: unknown,
    context?: VisualizerTrackValidationContext,
): EditorTrackIdentityV1 => {
    const value = record(input, 'project.track');
    keys(value, ['contentHash', 'fileName', 'durationSeconds'], [
        'title', 'artist', 'sampleRate',
    ], 'project.track');
    const contentHash = text(value.contentHash, 'project.track.contentHash');
    if (!HASH_PATTERN.test(contentHash)) invalid('project.track.contentHash is not SHA-256.');
    const durationSeconds = Math.round(
        finite(value.durationSeconds, 'project.track.durationSeconds') * 1_000_000,
    ) / 1_000_000;
    if (durationSeconds <= 0) invalid('project.track.durationSeconds must be positive.');
    let sampleRate: number | undefined;
    if (value.sampleRate !== undefined) {
        sampleRate = integer(value.sampleRate, 'project.track.sampleRate');
        if (sampleRate <= 0) invalid('project.track.sampleRate must be positive.');
    }
    if (context) {
        const tolerance = Math.max(MICROSECOND, 1 / context.sampleRate);
        if (
            contentHash !== context.contentHash
            || Math.abs(durationSeconds - context.durationSeconds) > tolerance
            || (sampleRate !== undefined && sampleRate !== context.sampleRate)
        ) {
            throw new VisualizerProjectValidationError(
                'track-mismatch',
                'Visualizer project belongs to another track.',
            );
        }
    }
    return {
        contentHash,
        fileName: text(value.fileName, 'project.track.fileName'),
        ...(value.title === undefined ? {} : { title: text(value.title, 'project.track.title') }),
        ...(value.artist === undefined ? {} : { artist: text(value.artist, 'project.track.artist') }),
        durationSeconds,
        ...(sampleRate === undefined ? {} : { sampleRate }),
    };
};

const canonicalConstant = (
    input: unknown,
    parameter: SceneParameterDescriptor,
    path: string,
): number | string | boolean | number[] => {
    if (parameter.valueKind === 'number') {
        const value = finite(input, path);
        const range = parameter.range;
        if (!range) return invalid(`${path} has no registered numeric range.`);
        assertInRange(value, range, path);
        return value;
    }
    if (parameter.valueKind === 'boolean') {
        if (typeof input !== 'boolean') invalid(`${path} must be boolean.`);
        return input as boolean;
    }
    if (parameter.valueKind === 'color') {
        const value = text(input, path);
        if (!/^#[0-9a-f]{6}$/i.test(value)) invalid(`${path} must be a six-digit color.`);
        return value;
    }
    if (!Array.isArray(input)) invalid(`${path} must be a numeric array.`);
    const values = input as unknown[];
    if (values.length === 0 && !parameter.allowEmptyVector) {
        invalid(`${path} must not be empty.`);
    }
    for (let index = 0; index < values.length; index += 1) {
        if (!(index in values)) invalid(`${path} must not be sparse.`);
    }
    return values.map((entry, index) => {
        const value = finite(entry, `${path}[${index}]`);
        if (parameter.vectorElementRange) {
            assertInRange(value, parameter.vectorElementRange, `${path}[${index}]`);
        }
        return value;
    });
};

const canonicalProjection = (
    input: unknown,
    path: string,
): VisualizerAnalysisProjectionV1 => {
    const value = record(input, path);
    const kind = value.kind;
    if (['scalar', 'full', 'mean', 'max', 'peak'].includes(String(kind))) {
        keys(value, ['kind'], [], path);
        return { kind: kind as 'scalar' | 'full' | 'mean' | 'max' | 'peak' };
    }
    if (kind === 'bin') {
        keys(value, ['kind', 'index'], [], path);
        const index = integer(value.index, `${path}.index`);
        if (index < 0) invalid(`${path}.index is invalid.`);
        return { kind, index };
    }
    if (kind === 'band') {
        keys(value, ['kind', 'start', 'end'], [], path);
        const start = integer(value.start, `${path}.start`);
        const end = integer(value.end, `${path}.end`);
        if (start < 0 || end <= start) invalid(`${path} is not a half-open band.`);
        return { kind, start, end };
    }
    return invalid(`${path}.kind is invalid.`);
};

const projectionLength = (featureId: FeatureId, component: VisualizerAnalysisComponent): number | null => {
    const definition = FEATURE_REGISTRY[featureId];
    if (definition.outputShape === 'scalar') {
        if (component !== 'default') invalid(`${featureId} only supports the default scalar component.`);
        return null;
    }
    if (definition.outputShape === 'loudness-structure') {
        if (component === 'total') return null;
        if (component === 'specific') return 24;
        invalid('loudness requires total or specific component.');
    }
    if (definition.outputShape === 'complex-spectrum') {
        if (!['real', 'imag', 'magnitude', 'phase'].includes(component)) {
            invalid('complexSpectrum requires a complex component.');
        }
        return 1024;
    }
    if (component !== 'default') invalid(`${featureId} only supports the default component.`);
    if (definition.outputShape === 'frequency-vector') return 512;
    if (definition.outputShape === 'category-vector') {
        return featureId === 'mfcc' ? 13 : 12;
    }
    // Buffer's compact display payload exposes the [min, max] envelope pair.
    // Raw 1,024-sample cursor frames remain Analyzer-only exact data.
    if (definition.outputShape === 'waveform') return 2;
    return invalid(`${featureId} has an unsupported projection shape.`);
};

const assertProjectionCompatible = (
    featureId: FeatureId,
    component: VisualizerAnalysisComponent,
    projection: VisualizerAnalysisProjectionV1,
    parameter: SceneParameterDescriptor,
): void => {
    const length = projectionLength(featureId, component);
    if (length === null) {
        if (projection.kind !== 'scalar' || parameter.valueKind !== 'number') {
            invalid(`${featureId} must use scalar projection for a numeric parameter.`);
        }
        return;
    }
    if (projection.kind === 'scalar') invalid(`${featureId} is not scalar.`);
    if (projection.kind === 'full' && parameter.valueKind !== 'vector') {
        invalid('full projection requires a vector parameter.');
    }
    if (projection.kind !== 'full' && parameter.valueKind !== 'number') {
        invalid('reduced vector projection requires a numeric parameter.');
    }
    if (projection.kind === 'bin' && projection.index >= length) {
        invalid('analysis bin is outside the registered dimensions.');
    }
    if (projection.kind === 'band' && projection.end > length) {
        invalid('analysis band is outside the registered dimensions.');
    }
};

const canonicalTransform = (
    input: unknown,
    path: string,
    fullVector: boolean,
): VisualizerNumericTransformV1 => {
    const value = record(input, path);
    keys(value, [
        'inputMin', 'inputMax', 'outputMin', 'outputMax', 'clamp', 'invert',
        'attackSeconds', 'releaseSeconds',
    ], [], path);
    const result: VisualizerNumericTransformV1 = {
        inputMin: finite(value.inputMin, `${path}.inputMin`),
        inputMax: finite(value.inputMax, `${path}.inputMax`),
        outputMin: finite(value.outputMin, `${path}.outputMin`),
        outputMax: finite(value.outputMax, `${path}.outputMax`),
        clamp: value.clamp as boolean,
        invert: value.invert as boolean,
        attackSeconds: finite(value.attackSeconds, `${path}.attackSeconds`),
        releaseSeconds: finite(value.releaseSeconds, `${path}.releaseSeconds`),
    };
    if (typeof result.clamp !== 'boolean' || typeof result.invert !== 'boolean') {
        invalid(`${path}.clamp and invert must be boolean.`);
    }
    if (result.inputMax <= result.inputMin) invalid(`${path} input range is collapsed.`);
    if (result.attackSeconds < 0 || result.releaseSeconds < 0) {
        invalid(`${path} smoothing must be non-negative.`);
    }
    if (fullVector && (result.attackSeconds !== 0 || result.releaseSeconds !== 0)) {
        invalid(`${path} cannot smooth full vectors.`);
    }
    return result;
};

const canonicalBinding = (
    input: unknown,
    parameter: SceneParameterDescriptor,
    editorProject: ReturnType<typeof validateEditorProjectV1> | undefined,
    path: string,
): VisualizerParameterBindingV1 => {
    const value = record(input, path);
    keys(value, ['parameterId', 'source'], ['transform'], path);
    if (text(value.parameterId, `${path}.parameterId`) !== parameter.id) {
        invalid(`${path}.parameterId does not match the registry order.`);
    }
    const sourceValue = record(value.source, `${path}.source`);
    if (
        typeof sourceValue.kind !== 'string'
        || !parameter.allowedSourceKinds.includes(
            sourceValue.kind as 'constant' | 'analysis' | 'editor-event',
        )
    ) {
        invalid(`${path}.source.kind is not allowed for ${parameter.id}.`);
    }
    let source: VisualizerBindingSourceV1;
    if (sourceValue.kind === 'constant') {
        keys(sourceValue, ['kind', 'value'], [], `${path}.source`);
        source = {
            kind: 'constant',
            value: canonicalConstant(sourceValue.value, parameter, `${path}.source.value`),
        };
    } else if (sourceValue.kind === 'analysis') {
        if (!['number', 'vector'].includes(parameter.valueKind)) {
            invalid(`${path} parameter cannot use analysis data.`);
        }
        keys(sourceValue, ['kind', 'featureId', 'projection'], ['component'], `${path}.source`);
        const rawFeatureId = sourceValue.featureId;
        if (!isFeatureId(rawFeatureId)) invalid(`${path}.source.featureId is invalid.`);
        const featureId: FeatureId = rawFeatureId as FeatureId;
        const component = sourceValue.component === undefined
            ? 'default'
            : sourceValue.component;
        if (typeof component !== 'string' || !COMPONENTS.has(component as VisualizerAnalysisComponent)) {
            invalid(`${path}.source.component is invalid.`);
        }
        const projection = canonicalProjection(sourceValue.projection, `${path}.source.projection`);
        if (!parameter.allowedAnalysisComponents?.includes(
            component as VisualizerAnalysisComponent,
        )) {
            invalid(`${path}.source.component is not allowed for ${parameter.id}.`);
        }
        if (!parameter.allowedAnalysisProjections?.includes(projection.kind)) {
            invalid(`${path}.source.projection is not allowed for ${parameter.id}.`);
        }
        assertProjectionCompatible(
            featureId,
            component as VisualizerAnalysisComponent,
            projection,
            parameter,
        );
        source = {
            kind: 'analysis',
            featureId,
            ...(sourceValue.component === undefined ? {} : { component: component as VisualizerAnalysisComponent }),
            projection,
        };
    } else if (sourceValue.kind === 'editor-event') {
        if (parameter.valueKind !== 'number') {
            invalid(`${path} parameter cannot use Editor events.`);
        }
        keys(sourceValue, ['kind', 'laneId'], ['innerClassId'], `${path}.source`);
        const laneId = text(sourceValue.laneId, `${path}.source.laneId`);
        const lane = editorProject?.lanes.find((entry) => entry.id === laneId);
        if (!lane) return invalid(`${path}.source.laneId is not present in the Editor snapshot.`);
        let innerClassId: string | undefined;
        if (sourceValue.innerClassId !== undefined) {
            innerClassId = text(sourceValue.innerClassId, `${path}.source.innerClassId`);
            if (!lane.innerClasses.some((entry) => entry.id === innerClassId)) {
                invalid(`${path}.source.innerClassId is not present in the lane.`);
            }
        }
        source = { kind: 'editor-event', laneId, ...(innerClassId ? { innerClassId } : {}) };
    } else {
        return invalid(`${path}.source.kind is invalid.`);
    }
    const transform = value.transform === undefined
        ? undefined
        : canonicalTransform(
            value.transform,
            `${path}.transform`,
            source.kind === 'analysis' && source.projection.kind === 'full',
        );
    if (transform && parameter.valueKind !== 'number' && !(source.kind === 'analysis' && source.projection.kind === 'full')) {
        invalid(`${path}.transform is only valid for numeric bindings.`);
    }
    const outputRange = parameter.valueKind === 'number'
        ? parameter.range
        : parameter.vectorElementRange;
    if (transform && outputRange) {
        assertInRange(transform.outputMin, outputRange, `${path}.transform.outputMin`);
        assertInRange(transform.outputMax, outputRange, `${path}.transform.outputMax`);
    }
    return { parameterId: parameter.id, source, ...(transform ? { transform } : {}) };
};

export const validateVisualizerProjectV1 = (
    input: unknown,
    context?: VisualizerTrackValidationContext,
    registry = new SceneRegistry(),
): VisualizerProjectV1 => {
    const value = record(input, 'project');
    if (value.format !== 'audiosurf-visualizer' || value.schemaVersion !== 1) {
        if (value.schemaVersion !== 1) {
            throw new VisualizerProjectValidationError(
                'unsupported-schema',
                `Unsupported Visualizer schema: ${String(value.schemaVersion)}.`,
            );
        }
        invalid('Visualizer project format is invalid.');
    }
    keys(value, [
        'format', 'schemaVersion', 'projectId', 'createdAt', 'updatedAt',
        'track', 'output', 'scene',
    ], ['editorSnapshot'], 'project');
    const projectId = text(value.projectId, 'project.projectId');
    if (!UUID_PATTERN.test(projectId)) invalid('project.projectId must be a UUID.');
    const createdAt = iso(value.createdAt, 'project.createdAt');
    const updatedAt = iso(value.updatedAt, 'project.updatedAt');
    if (Date.parse(updatedAt) < Date.parse(createdAt)) invalid('project.updatedAt precedes createdAt.');
    const track = canonicalTrack(value.track, context);
    const output = record(value.output, 'project.output');
    keys(output, ['aspectRatio', 'resolution', 'frameRate'], [], 'project.output');
    if (output.aspectRatio !== '16:9') invalid('project.output.aspectRatio must be 16:9.');
    if (output.resolution !== '720p' && output.resolution !== '1080p') {
        invalid('project.output.resolution is invalid.');
    }
    if (output.frameRate !== 30 && output.frameRate !== 60) {
        invalid('project.output.frameRate is invalid.');
    }

    let editorSnapshot: VisualizerProjectV1['editorSnapshot'];
    if (value.editorSnapshot !== undefined) {
        const snapshot = record(value.editorSnapshot, 'project.editorSnapshot');
        keys(snapshot, ['capturedAt', 'project'], [], 'project.editorSnapshot');
        const editorProject = validateEditorProjectV1(snapshot.project, {
            contentHash: track.contentHash,
            durationSeconds: track.durationSeconds,
            sampleRate: track.sampleRate ?? context?.sampleRate ?? 48_000,
        });
        editorSnapshot = {
            capturedAt: iso(snapshot.capturedAt, 'project.editorSnapshot.capturedAt'),
            project: editorProject,
        };
    }

    const scene = record(value.scene, 'project.scene');
    keys(scene, ['templateId', 'templateVersion', 'seed', 'bindings'], [], 'project.scene');
    if (scene.templateId !== 'orthogonal-lines' && scene.templateId !== 'cube-swarm') {
        invalid('project.scene.templateId is invalid.');
    }
    if (scene.templateVersion !== 1) invalid('project.scene.templateVersion is invalid.');
    const templateId = scene.templateId as VisualizerTemplateId;
    const descriptor: SceneTemplateDescriptor = (() => {
        try {
            return registry.get(templateId, 1);
        } catch (error) {
            return invalid(
                error instanceof Error
                    ? error.message
                    : 'Unknown Visualizer template.',
            );
        }
    })();
    const seed = integer(scene.seed, 'project.scene.seed');
    if (seed < 0 || seed > 0xffff_ffff) invalid('project.scene.seed is outside uint32.');
    if (!Array.isArray(scene.bindings) || scene.bindings.length !== descriptor.parameters.length) {
        invalid('project.scene.bindings must contain every template parameter exactly once.');
    }
    const rawBindings = scene.bindings as unknown[];
    for (let index = 0; index < rawBindings.length; index += 1) {
        if (!(index in rawBindings)) invalid('project.scene.bindings must not be sparse.');
    }
    const seen = new Set<string>();
    const bindings = descriptor.parameters.map((parameter, index) => {
        const raw = record(rawBindings[index], `project.scene.bindings[${index}]`);
        const parameterId = typeof raw.parameterId === 'string' ? raw.parameterId : '';
        if (seen.has(parameterId)) invalid('project.scene.bindings contains a duplicate parameter.');
        seen.add(parameterId);
        return canonicalBinding(
            raw,
            parameter,
            editorSnapshot?.project,
            `project.scene.bindings[${index}]`,
        );
    });
    const activeFeatures = new Set(
        bindings.flatMap((binding) => binding.source.kind === 'analysis'
            ? [binding.source.featureId]
            : []),
    );
    if (activeFeatures.size > 4) {
        throw new VisualizerProjectValidationError(
            'analysis-feature-limit',
            'Visualizer projects may use at most four unique analysis features.',
        );
    }
    return {
        format: 'audiosurf-visualizer',
        schemaVersion: 1,
        projectId,
        createdAt,
        updatedAt,
        track,
        output: {
            aspectRatio: '16:9',
            resolution: output.resolution as '720p' | '1080p',
            frameRate: output.frameRate as 30 | 60,
        },
        scene: { templateId, templateVersion: 1, seed, bindings },
        ...(editorSnapshot ? { editorSnapshot } : {}),
    };
};

export const createInitialVisualizerProject = (input: {
    track: EditorTrackIdentityV1;
    registry?: SceneRegistry;
    createId?: () => string;
    createSeed?: () => number;
    now?: () => Date;
}): VisualizerProjectV1 => {
    const registry = input.registry ?? new SceneRegistry();
    const now = input.now ?? (() => new Date());
    const timestamp = now().toISOString();
    const createSeed = input.createSeed ?? (() => crypto.getRandomValues(new Uint32Array(1))[0]!);
    return validateVisualizerProjectV1({
        format: 'audiosurf-visualizer',
        schemaVersion: 1,
        projectId: (input.createId ?? (() => crypto.randomUUID()))(),
        createdAt: timestamp,
        updatedAt: timestamp,
        track: input.track,
        output: { aspectRatio: '16:9', resolution: '720p', frameRate: 30 },
        scene: {
            templateId: 'orthogonal-lines',
            templateVersion: 1,
            seed: createSeed(),
            bindings: registry.createConstantBindings('orthogonal-lines'),
        },
    }, undefined, registry);
};

export const encodeVisualizerProjectV1 = (
    project: VisualizerProjectV1,
    registry?: SceneRegistry,
): Uint8Array => new TextEncoder().encode(
    `${JSON.stringify(validateVisualizerProjectV1(project, undefined, registry), null, 2)}\n`,
);

export const decodeVisualizerProjectV1 = (
    input: ArrayBuffer | Uint8Array | string,
    context?: VisualizerTrackValidationContext,
    registry?: SceneRegistry,
): VisualizerProjectV1 => {
    try {
        const source = typeof input === 'string'
            ? input
            : new TextDecoder('utf-8', { fatal: true }).decode(input);
        return validateVisualizerProjectV1(JSON.parse(source) as unknown, context, registry);
    } catch (error) {
        if (error instanceof VisualizerProjectValidationError) throw error;
        throw new VisualizerProjectValidationError(
            'parse-failed',
            error instanceof Error ? error.message : 'Visualizer JSON parse failed.',
        );
    }
};

export interface VisualizerFormatCodec {
    id: 'json-v1';
    label: 'JSON';
    extension: '.audiosurf-visualizer.json';
    mimeType: 'application/json';
    encode(project: VisualizerProjectV1, registry?: SceneRegistry): Uint8Array;
    decode(
        input: ArrayBuffer | Uint8Array | string,
        context?: VisualizerTrackValidationContext,
        registry?: SceneRegistry,
    ): VisualizerProjectV1;
}

export const VISUALIZER_JSON_V1_CODEC: VisualizerFormatCodec = {
    id: 'json-v1',
    label: 'JSON',
    extension: '.audiosurf-visualizer.json',
    mimeType: 'application/json',
    encode: encodeVisualizerProjectV1,
    decode: decodeVisualizerProjectV1,
};

export class VisualizerFormatCodecRegistry {
    private readonly codecs = new Map<string, VisualizerFormatCodec>();

    constructor(codecs: readonly VisualizerFormatCodec[] = [VISUALIZER_JSON_V1_CODEC]) {
        for (const codec of codecs) {
            if (this.codecs.has(codec.id)) throw new Error(`Duplicate Visualizer codec: ${codec.id}`);
            this.codecs.set(codec.id, codec);
        }
    }

    list(): readonly VisualizerFormatCodec[] {
        return [...this.codecs.values()];
    }

    get(id: string): VisualizerFormatCodec {
        const codec = this.codecs.get(id);
        if (!codec) throw new Error(`Unknown Visualizer codec: ${id}`);
        return codec;
    }
}

export const visualizerProjectFileName = (
    fileName: string,
    codec: VisualizerFormatCodec,
): string => {
    const base = fileName.replace(/\.[^.]+$/, '').trim() || 'visualizer-project';
    return `${base}${codec.extension}`;
};
