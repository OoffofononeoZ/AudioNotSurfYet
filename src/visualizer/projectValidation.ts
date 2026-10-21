import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import { isStemRole, isStemFeature } from '../analysis/sources';
import { isFeatureId, type FeatureId } from '../analysis/types';
import { validateEditorProjectV2 } from '../editor/projectCodec';
import type { EditorTrackIdentityV1 } from '../editor/types';
import type { SceneNumericRange, SceneParameterDescriptor } from './parameterDescriptor';
import type {
    VisualizerAnalysisComponent,
    VisualizerAnalysisProjectionV1,
    VisualizerBindingSourceV1,
    VisualizerNumericTransformV1,
    VisualizerParameterBindingV1,
    VisualizerTrackValidationContext,
} from './types';

const HASH_PATTERN = /^[a-f\d]{64}$/i;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MICROSECOND = 1e-6;
const COMPONENTS = new Set<VisualizerAnalysisComponent>([
    'default',
    'total',
    'specific',
    'real',
    'imag',
    'magnitude',
    'phase',
]);
type UnknownRecord = Record<string, unknown>;

export type VisualizerProjectValidationCode =
    'parse-failed' | 'invalid-schema' | 'unsupported-schema' | 'track-mismatch' | 'analysis-feature-limit';

export class VisualizerProjectValidationError extends Error {
    readonly code: VisualizerProjectValidationCode;

    constructor(code: VisualizerProjectValidationCode, message: string) {
        super(message);
        this.name = 'VisualizerProjectValidationError';
        this.code = code;
    }
}

export const invalid = (message: string): never => {
    throw new VisualizerProjectValidationError('invalid-schema', message);
};

const isRecord = (value: unknown): value is UnknownRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const record = (value: unknown, path: string): UnknownRecord => {
    if (!isRecord(value)) invalid(`${path} must be an object.`);
    return value as UnknownRecord;
};

export const keys = (
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

export const finite = (value: unknown, path: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0)) {
        invalid(`${path} must be a finite number other than -0.`);
    }
    return value as number;
};

export const integer = (value: unknown, path: string): number => {
    const result = finite(value, path);
    if (!Number.isInteger(result)) invalid(`${path} must be an integer.`);
    return result;
};

const assertInRange = (value: number, range: SceneNumericRange, path: string): void => {
    if (value < range.min || value > range.max) {
        invalid(`${path} must be between ${range.min} and ${range.max}.`);
    }
    if (range.integer && !Number.isInteger(value)) {
        invalid(`${path} must be an integer.`);
    }
};

export const text = (value: unknown, path: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        invalid(`${path} must be a non-empty string.`);
    }
    return value as string;
};

export const iso = (value: unknown, path: string): string => {
    const result = text(value, path);
    if (!Number.isFinite(Date.parse(result))) invalid(`${path} must be ISO time.`);
    return result;
};

export const canonicalTrack = (input: unknown, context?: VisualizerTrackValidationContext): EditorTrackIdentityV1 => {
    const value = record(input, 'project.track');
    keys(value, ['contentHash', 'fileName', 'durationSeconds'], ['title', 'artist', 'sampleRate'], 'project.track');
    const contentHash = text(value.contentHash, 'project.track.contentHash');
    if (!HASH_PATTERN.test(contentHash)) invalid('project.track.contentHash is not SHA-256.');
    const durationSeconds =
        Math.round(finite(value.durationSeconds, 'project.track.durationSeconds') * 1_000_000) / 1_000_000;
    if (durationSeconds <= 0) invalid('project.track.durationSeconds must be positive.');
    let sampleRate: number | undefined;
    if (value.sampleRate !== undefined) {
        sampleRate = integer(value.sampleRate, 'project.track.sampleRate');
        if (sampleRate <= 0) invalid('project.track.sampleRate must be positive.');
    }
    if (context) {
        const tolerance = Math.max(MICROSECOND, 1 / context.sampleRate);
        if (
            contentHash !== context.contentHash ||
            Math.abs(durationSeconds - context.durationSeconds) > tolerance ||
            (sampleRate !== undefined && sampleRate !== context.sampleRate)
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

const canonicalProjection = (input: unknown, path: string): VisualizerAnalysisProjectionV1 => {
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
    if (definition.outputShape === 'waveform') return 1024;
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

const canonicalTransform = (input: unknown, path: string, fullVector: boolean): VisualizerNumericTransformV1 => {
    const value = record(input, path);
    keys(
        value,
        ['inputMin', 'inputMax', 'outputMin', 'outputMax', 'clamp', 'invert', 'attackSeconds', 'releaseSeconds'],
        [],
        path,
    );
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

export const canonicalBinding = (
    input: unknown,
    parameter: SceneParameterDescriptor,
    editorProject: ReturnType<typeof validateEditorProjectV2> | undefined,
    path: string,
): VisualizerParameterBindingV1 => {
    const value = record(input, path);
    keys(value, ['parameterId', 'source'], ['transform'], path);
    if (text(value.parameterId, `${path}.parameterId`) !== parameter.id) {
        invalid(`${path}.parameterId does not match the registry order.`);
    }
    const sourceValue = record(value.source, `${path}.source`);
    if (
        typeof sourceValue.kind !== 'string' ||
        !parameter.allowedSourceKinds.includes(sourceValue.kind as 'constant' | 'analysis' | 'editor-event')
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
        keys(sourceValue, ['kind', 'featureId', 'projection'], ['component', 'stemRole'], `${path}.source`);
        const rawFeatureId = sourceValue.featureId;
        if (!isFeatureId(rawFeatureId)) invalid(`${path}.source.featureId is invalid.`);
        const featureId: FeatureId = rawFeatureId as FeatureId;
        if (
            sourceValue.stemRole !== undefined &&
            (!isStemRole(sourceValue.stemRole) || !isStemFeature(featureId) || parameter.valueKind !== 'vector')
        )
            invalid(`${path}.source.stemRole requires a compatible spectrum input.`);
        const component = sourceValue.component === undefined ? 'default' : sourceValue.component;
        if (typeof component !== 'string' || !COMPONENTS.has(component as VisualizerAnalysisComponent)) {
            invalid(`${path}.source.component is invalid.`);
        }
        const projection = canonicalProjection(sourceValue.projection, `${path}.source.projection`);
        if (!parameter.allowedAnalysisComponents?.includes(component as VisualizerAnalysisComponent)) {
            invalid(`${path}.source.component is not allowed for ${parameter.id}.`);
        }
        if (!parameter.allowedAnalysisProjections?.includes(projection.kind)) {
            invalid(`${path}.source.projection is not allowed for ${parameter.id}.`);
        }
        assertProjectionCompatible(featureId, component as VisualizerAnalysisComponent, projection, parameter);
        source = {
            kind: 'analysis',
            featureId,
            ...(sourceValue.stemRole === undefined
                ? {}
                : { stemRole: sourceValue.stemRole as import('../processing/modelManifest').StemRole }),
            ...(sourceValue.component === undefined ? {} : { component: component as VisualizerAnalysisComponent }),
            projection,
        };
    } else if (sourceValue.kind === 'editor-event') {
        if (parameter.valueKind !== 'number') {
            invalid(`${path} parameter cannot use Editor events.`);
        }
        keys(sourceValue, ['kind', 'laneId'], ['innerClassId'], `${path}.source`);
        const laneId = text(sourceValue.laneId, `${path}.source.laneId`);
        const lane = editorProject?.lanes.find(entry => entry.id === laneId);
        if (!lane) return invalid(`${path}.source.laneId is not present in the Editor snapshot.`);
        let innerClassId: string | undefined;
        if (sourceValue.innerClassId !== undefined) {
            innerClassId = text(sourceValue.innerClassId, `${path}.source.innerClassId`);
            if (!lane.innerClasses.some(entry => entry.id === innerClassId)) {
                invalid(`${path}.source.innerClassId is not present in the lane.`);
            }
        }
        source = { kind: 'editor-event', laneId, ...(innerClassId ? { innerClassId } : {}) };
    } else {
        return invalid(`${path}.source.kind is invalid.`);
    }
    const transform =
        value.transform === undefined
            ? undefined
            : canonicalTransform(
                  value.transform,
                  `${path}.transform`,
                  source.kind === 'analysis' && source.projection.kind === 'full',
              );
    if (
        transform &&
        parameter.valueKind !== 'number' &&
        !(source.kind === 'analysis' && source.projection.kind === 'full')
    ) {
        invalid(`${path}.transform is only valid for numeric bindings.`);
    }
    const outputRange = parameter.valueKind === 'number' ? parameter.range : parameter.vectorElementRange;
    if (transform && outputRange) {
        assertInRange(transform.outputMin, outputRange, `${path}.transform.outputMin`);
        assertInRange(transform.outputMax, outputRange, `${path}.transform.outputMax`);
    }
    return { parameterId: parameter.id, source, ...(transform ? { transform } : {}) };
};
