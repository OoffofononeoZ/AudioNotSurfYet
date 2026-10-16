import {
    isFeatureId,
    type AnalysisSeries,
    type CompactPayload,
    type FeatureId,
} from './types';

const U16_MAX = 65_535;
const I16_MAX = 32_767;

interface QuantizedValues {
    values: Uint16Array;
    scale: number;
    offset: number;
}

const assertFiniteValues = (values: ArrayLike<number>): void => {
    for (let index = 0; index < values.length; index += 1) {
        if (!Number.isFinite(values[index])) {
            throw new RangeError(`Non-finite value at index ${index}.`);
        }
    }
};

export const quantizeToUint16 = (
    input: ArrayLike<number>,
    bounds?: { min: number; max: number },
): QuantizedValues => {
    if (input.length === 0) {
        return {
            values: new Uint16Array(),
            scale: 0,
            offset: bounds?.min ?? 0,
        };
    }
    assertFiniteValues(input);
    let actualMin = Infinity;
    let actualMax = -Infinity;
    for (let index = 0; index < input.length; index += 1) {
        const value = input[index] ?? 0;
        actualMin = Math.min(actualMin, value);
        actualMax = Math.max(actualMax, value);
    }
    if (
        bounds
        && (
            !Number.isFinite(bounds.min)
            || !Number.isFinite(bounds.max)
            || bounds.max < bounds.min
            || actualMin < bounds.min
            || actualMax > bounds.max
        )
    ) {
        throw new RangeError('Values exceed explicit quantization bounds.');
    }
    const offset = bounds?.min ?? actualMin;
    const maximum = bounds?.max ?? actualMax;
    const scale = maximum === offset ? 0 : (maximum - offset) / U16_MAX;
    const values = new Uint16Array(input.length);
    if (scale === 0) return { values, scale, offset };

    for (let index = 0; index < input.length; index += 1) {
        const quantized = Math.round(((input[index] ?? 0) - offset) / scale);
        if (quantized < 0 || quantized > U16_MAX) {
            throw new RangeError('Quantization would silently clip a value.');
        }
        values[index] = quantized;
    }
    return { values, scale, offset };
};

export const dequantizeUint16 = (
    values: Uint16Array,
    scale: number,
    offset: number,
): Float32Array => {
    if (!Number.isFinite(scale) || scale < 0 || !Number.isFinite(offset)) {
        throw new RangeError('Invalid quantization metadata.');
    }
    const result = new Float32Array(values.length);
    for (let index = 0; index < values.length; index += 1) {
        result[index] = scale === 0
            ? offset
            : offset + (values[index] ?? 0) * scale;
    }
    return result;
};

export const aggregateScalars = (
    frames: readonly number[],
    factor: number,
): Float32Array => {
    if (!Number.isInteger(factor) || factor <= 0) {
        throw new RangeError('Aggregation factor must be positive.');
    }
    assertFiniteValues(frames);
    const count = Math.ceil(frames.length / factor);
    const output = new Float32Array(count);
    for (let bucket = 0; bucket < count; bucket += 1) {
        const start = bucket * factor;
        const end = Math.min(start + factor, frames.length);
        let sum = 0;
        for (let index = start; index < end; index += 1) {
            sum += frames[index] ?? 0;
        }
        output[bucket] = sum / Math.max(1, end - start);
    }
    return output;
};

export const aggregateVectors = (
    frames: readonly (readonly number[])[],
    factor: number,
    width: number,
): Float32Array => {
    if (
        !Number.isInteger(factor)
        || factor <= 0
        || !Number.isInteger(width)
        || width <= 0
        || frames.some((frame) => frame.length !== width)
    ) {
        throw new RangeError('Invalid vector aggregation input.');
    }
    const bucketCount = Math.ceil(frames.length / factor);
    const output = new Float32Array(bucketCount * width);
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
        const start = bucket * factor;
        const end = Math.min(start + factor, frames.length);
        for (let frameIndex = start; frameIndex < end; frameIndex += 1) {
            const frame = frames[frameIndex];
            if (!frame) continue;
            assertFiniteValues(frame);
            for (let valueIndex = 0; valueIndex < width; valueIndex += 1) {
                const outputIndex = bucket * width + valueIndex;
                output[outputIndex] =
                    (output[outputIndex] ?? 0)
                    + (frame[valueIndex] ?? 0);
            }
        }
        const divisor = Math.max(1, end - start);
        for (let valueIndex = 0; valueIndex < width; valueIndex += 1) {
            const outputIndex = bucket * width + valueIndex;
            output[outputIndex] =
                (output[outputIndex] ?? 0) / divisor;
        }
    }
    return output;
};

export const aggregateWaveform = (
    frames: readonly (readonly number[])[],
    factor: number,
): { min: Int16Array; max: Int16Array; scale: number } => {
    if (!Number.isInteger(factor) || factor <= 0) {
        throw new RangeError('Aggregation factor must be positive.');
    }
    const bucketCount = Math.ceil(frames.length / factor);
    const minimums = new Float32Array(bucketCount);
    const maximums = new Float32Array(bucketCount);
    let maximumAbsolute = 0;
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
        let minimum = Infinity;
        let maximum = -Infinity;
        const start = bucket * factor;
        const end = Math.min(start + factor, frames.length);
        for (let frameIndex = start; frameIndex < end; frameIndex += 1) {
            const frame = frames[frameIndex] ?? [];
            assertFiniteValues(frame);
            for (const value of frame) {
                minimum = Math.min(minimum, value);
                maximum = Math.max(maximum, value);
            }
        }
        minimums[bucket] = Number.isFinite(minimum) ? minimum : 0;
        maximums[bucket] = Number.isFinite(maximum) ? maximum : 0;
        maximumAbsolute = Math.max(
            maximumAbsolute,
            Math.abs(minimums[bucket] ?? 0),
            Math.abs(maximums[bucket] ?? 0),
        );
    }
    const scale = maximumAbsolute === 0 ? 0 : maximumAbsolute / I16_MAX;
    const minimum = new Int16Array(bucketCount);
    const maximum = new Int16Array(bucketCount);
    if (scale > 0) {
        for (let index = 0; index < bucketCount; index += 1) {
            minimum[index] = Math.round((minimums[index] ?? 0) / scale);
            maximum[index] = Math.round((maximums[index] ?? 0) / scale);
        }
    }
    return { min: minimum, max: maximum, scale };
};

export const aggregateComplex = (
    frames: readonly {
        real: readonly number[];
        imag: readonly number[];
    }[],
    factor: number,
    bins: number,
): {
    magnitude: Uint16Array;
    phase: Int16Array;
    magnitudeScale: number;
} => {
    if (
        !Number.isInteger(factor)
        || factor <= 0
        || !Number.isInteger(bins)
        || bins <= 0
        || frames.some((frame) =>
            frame.real.length !== bins || frame.imag.length !== bins)
    ) {
        throw new RangeError('Invalid complex aggregation input.');
    }
    const bucketCount = Math.ceil(frames.length / factor);
    const magnitudes = new Float32Array(bucketCount * bins);
    const phases = new Float32Array(bucketCount * bins);
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
        const start = bucket * factor;
        const end = Math.min(start + factor, frames.length);
        const divisor = Math.max(1, end - start);
        for (let bin = 0; bin < bins; bin += 1) {
            let magnitude = 0;
            let sine = 0;
            let cosine = 0;
            for (let frameIndex = start; frameIndex < end; frameIndex += 1) {
                const frame = frames[frameIndex];
                const real = frame?.real[bin] ?? 0;
                const imaginary = frame?.imag[bin] ?? 0;
                if (!Number.isFinite(real) || !Number.isFinite(imaginary)) {
                    throw new RangeError('Complex values must be finite.');
                }
                magnitude += Math.hypot(real, imaginary);
                const phase = Math.atan2(imaginary, real);
                sine += Math.sin(phase);
                cosine += Math.cos(phase);
            }
            const outputIndex = bucket * bins + bin;
            magnitudes[outputIndex] = magnitude / divisor;
            phases[outputIndex] = Math.atan2(
                sine / divisor,
                cosine / divisor,
            );
        }
    }
    let maximumMagnitude = 0;
    for (const magnitude of magnitudes) {
        maximumMagnitude = Math.max(maximumMagnitude, magnitude);
    }
    const quantized = quantizeToUint16(magnitudes, {
        min: 0,
        max: maximumMagnitude,
    });
    const phase = new Int16Array(phases.length);
    for (let index = 0; index < phases.length; index += 1) {
        phase[index] = Math.round(
            Math.max(-1, Math.min(1, (phases[index] ?? 0) / Math.PI))
            * I16_MAX,
        );
    }
    return {
        magnitude: quantized.values,
        phase,
        magnitudeScale: quantized.scale,
    };
};

type TypedArrayName = 'f32' | 'u16' | 'i16';

interface ByteRange {
    name: string;
    type: TypedArrayName;
    offset: number;
    length: number;
    byteLength: number;
}

interface CacheHeader {
    schemaVersion: 1;
    trackHash: string;
    configHash: string;
    featureId: FeatureId;
    payloadKind: CompactPayload['kind'];
    sampleStepSeconds: number;
    sampleCount: number;
    dimensions: readonly number[];
    scale?: number;
    offset?: number;
    width?: number;
    bands?: number;
    bins?: number;
    magnitudeScale?: number;
    ranges: ByteRange[];
}

const arrayType = (
    value: Float32Array | Uint16Array | Int16Array,
): TypedArrayName => {
    if (value instanceof Float32Array) return 'f32';
    if (value instanceof Uint16Array) return 'u16';
    return 'i16';
};

const payloadArrays = (
    payload: CompactPayload,
): Array<{
    name: string;
    value: Float32Array | Uint16Array | Int16Array;
}> => {
    switch (payload.kind) {
        case 'scalar-f32':
        case 'stereo-spectrum-f32':
        case 'frequency-u16':
        case 'category-u16':
            return [{ name: 'values', value: payload.values }];
        case 'waveform-envelope':
            return [
                { name: 'min', value: payload.min },
                { name: 'max', value: payload.max },
            ];
        case 'loudness':
            return [
                { name: 'total', value: payload.total },
                { name: 'specific', value: payload.specific },
            ];
        case 'complex-derived':
            return [
                { name: 'magnitude', value: payload.magnitude },
                { name: 'phase', value: payload.phase },
            ];
    }
};

const headerForSeries = (
    series: AnalysisSeries,
    ranges: ByteRange[],
): CacheHeader => {
    const common = {
        schemaVersion: 1 as const,
        trackHash: series.trackHash,
        configHash: series.configHash,
        featureId: series.featureId,
        payloadKind: series.payload.kind,
        sampleStepSeconds: series.sampleStepSeconds,
        sampleCount: series.sampleCount,
        dimensions: series.dimensions,
        ranges,
    };
    switch (series.payload.kind) {
        case 'stereo-spectrum-f32':
            return { ...common, width: series.payload.width };
        case 'scalar-f32':
            return common;
        case 'frequency-u16':
        case 'category-u16':
            return {
                ...common,
                scale: series.payload.scale,
                offset: series.payload.offset,
                width: series.payload.width,
            };
        case 'waveform-envelope':
            return { ...common, scale: series.payload.scale };
        case 'loudness':
            return {
                ...common,
                scale: series.payload.scale,
                offset: series.payload.offset,
                bands: series.payload.bands,
            };
        case 'complex-derived':
            return {
                ...common,
                bins: series.payload.bins,
                magnitudeScale: series.payload.magnitudeScale,
            };
    }
};

export const encodeAnalysisSeries = (
    series: AnalysisSeries,
): ArrayBuffer => {
    validateSeriesShape(series);
    const arrays = payloadArrays(series.payload);
    let byteOffset = 0;
    const ranges = arrays.map(({ name, value }) => {
        const range = {
            name,
            type: arrayType(value),
            offset: byteOffset,
            length: value.length,
            byteLength: value.byteLength,
        };
        byteOffset += value.byteLength;
        return range;
    });
    const headerBytes = new TextEncoder().encode(
        JSON.stringify(headerForSeries(series, ranges)),
    );
    const result = new ArrayBuffer(4 + headerBytes.length + byteOffset);
    const view = new DataView(result);
    view.setUint32(0, headerBytes.length, true);
    new Uint8Array(result, 4, headerBytes.length).set(headerBytes);
    const bytes = new Uint8Array(result, 4 + headerBytes.length);
    for (let index = 0; index < arrays.length; index += 1) {
        const range = ranges[index];
        const array = arrays[index]?.value;
        if (!range || !array) continue;
        bytes.set(
            new Uint8Array(
                array.buffer,
                array.byteOffset,
                array.byteLength,
            ),
            range.offset,
        );
    }
    return result;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const typeBytes = (type: TypedArrayName): number =>
    type === 'f32' ? Float32Array.BYTES_PER_ELEMENT : 2;

const readArray = (
    data: Uint8Array,
    range: ByteRange,
): Float32Array | Uint16Array | Int16Array => {
    const copy = data.slice(range.offset, range.offset + range.byteLength);
    if (range.type === 'f32') return new Float32Array(copy.buffer);
    if (range.type === 'u16') return new Uint16Array(copy.buffer);
    return new Int16Array(copy.buffer);
};

const finiteMetadata = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

export const decodeAnalysisSeries = (
    encoded: ArrayBuffer,
    expected?: {
        trackHash: string;
        configHash: string;
        featureId: FeatureId;
    },
): AnalysisSeries => {
    if (encoded.byteLength < 5) {
        throw new Error('Analysis cache payload is truncated.');
    }
    const headerLength = new DataView(encoded).getUint32(0, true);
    if (headerLength <= 0 || 4 + headerLength > encoded.byteLength) {
        throw new Error('Analysis cache header length is invalid.');
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(
                new Uint8Array(encoded, 4, headerLength),
            ),
        );
    } catch {
        throw new Error('Analysis cache header is invalid.');
    }
    if (
        !isRecord(parsed)
        || parsed.schemaVersion !== 1
        || typeof parsed.trackHash !== 'string'
        || typeof parsed.configHash !== 'string'
        || !isFeatureId(parsed.featureId)
        || typeof parsed.payloadKind !== 'string'
        || !finiteMetadata(parsed.sampleStepSeconds)
        || parsed.sampleStepSeconds <= 0
        || !Number.isInteger(parsed.sampleCount)
        || (parsed.sampleCount as number) < 0
        || !Array.isArray(parsed.dimensions)
        || !parsed.dimensions.every((value) =>
            Number.isInteger(value) && (value as number) > 0)
        || !Array.isArray(parsed.ranges)
    ) {
        throw new Error('Analysis cache header schema is invalid.');
    }
    if (
        expected
        && (
            parsed.trackHash !== expected.trackHash
            || parsed.configHash !== expected.configHash
            || parsed.featureId !== expected.featureId
        )
    ) {
        throw new Error('Analysis cache identity does not match.');
    }
    const ranges: ByteRange[] = [];
    let expectedOffset = 0;
    for (const raw of parsed.ranges) {
        if (
            !isRecord(raw)
            || typeof raw.name !== 'string'
            || !['f32', 'u16', 'i16'].includes(raw.type as string)
            || !Number.isInteger(raw.offset)
            || raw.offset !== expectedOffset
            || !Number.isInteger(raw.length)
            || (raw.length as number) < 0
            || !Number.isInteger(raw.byteLength)
            || raw.byteLength
                !== (raw.length as number)
                * typeBytes(raw.type as TypedArrayName)
            || (raw.offset as number) % typeBytes(raw.type as TypedArrayName)
                !== 0
        ) {
            throw new Error('Analysis cache byte range is invalid.');
        }
        const range = raw as unknown as ByteRange;
        expectedOffset += range.byteLength;
        ranges.push(range);
    }
    const data = new Uint8Array(encoded, 4 + headerLength);
    if (expectedOffset !== data.byteLength) {
        throw new Error('Analysis cache contains missing or trailing data.');
    }
    const byName = new Map(
        ranges.map((range) => [range.name, readArray(data, range)]),
    );
    const payload = decodePayload(parsed as unknown as CacheHeader, byName);
    const series: AnalysisSeries = {
        schemaVersion: 1,
        trackHash: parsed.trackHash,
        configHash: parsed.configHash,
        featureId: parsed.featureId,
        startTimeSeconds: 0,
        sampleStepSeconds: parsed.sampleStepSeconds,
        sampleCount: parsed.sampleCount as number,
        dimensions: parsed.dimensions as number[],
        payload,
    };
    validateSeriesShape(series);
    return series;
};

const requiredArray = <T>(
    arrays: Map<string, Float32Array | Uint16Array | Int16Array>,
    name: string,
    constructor: new (buffer: ArrayBuffer) => T,
): T => {
    const value = arrays.get(name);
    if (!value || !(value instanceof constructor)) {
        throw new Error(`Analysis cache array ${name} is missing or invalid.`);
    }
    return value as T;
};

const decodePayload = (
    header: CacheHeader,
    arrays: Map<string, Float32Array | Uint16Array | Int16Array>,
): CompactPayload => {
    switch (header.payloadKind) {
        case 'stereo-spectrum-f32':
            if (header.width !== 128) throw new Error('Stereo spectrum width is invalid.');
            return { kind: 'stereo-spectrum-f32', width: 128, values: requiredArray(arrays, 'values', Float32Array) };
        case 'scalar-f32':
            return {
                kind: 'scalar-f32',
                values: requiredArray(
                    arrays,
                    'values',
                    Float32Array,
                ),
            };
        case 'frequency-u16':
        case 'category-u16':
            if (
                !Number.isInteger(header.width)
                || !finiteMetadata(header.scale)
                || !finiteMetadata(header.offset)
            ) {
                throw new Error('Quantized cache metadata is invalid.');
            }
            return {
                kind: header.payloadKind,
                values: requiredArray(arrays, 'values', Uint16Array),
                width: header.width as number,
                scale: header.scale,
                offset: header.offset,
            };
        case 'waveform-envelope':
            if (!finiteMetadata(header.scale)) {
                throw new Error('Waveform cache metadata is invalid.');
            }
            return {
                kind: 'waveform-envelope',
                min: requiredArray(arrays, 'min', Int16Array),
                max: requiredArray(arrays, 'max', Int16Array),
                scale: header.scale,
            };
        case 'loudness':
            if (
                header.bands !== 24
                || !finiteMetadata(header.scale)
                || !finiteMetadata(header.offset)
            ) {
                throw new Error('Loudness cache metadata is invalid.');
            }
            return {
                kind: 'loudness',
                total: requiredArray(arrays, 'total', Float32Array),
                specific: requiredArray(arrays, 'specific', Uint16Array),
                bands: 24,
                scale: header.scale,
                offset: header.offset,
            };
        case 'complex-derived':
            if (
                !Number.isInteger(header.bins)
                || !finiteMetadata(header.magnitudeScale)
            ) {
                throw new Error('Complex cache metadata is invalid.');
            }
            return {
                kind: 'complex-derived',
                magnitude: requiredArray(
                    arrays,
                    'magnitude',
                    Uint16Array,
                ),
                phase: requiredArray(arrays, 'phase', Int16Array),
                bins: header.bins as number,
                magnitudeScale: header.magnitudeScale,
            };
        default:
            throw new Error('Analysis cache payload kind is unsupported.');
    }
};

const dimensionWidth = (dimensions: readonly number[]): number =>
    dimensions.reduce((product, value) => product * value, 1);

export const validateSeriesShape = (series: AnalysisSeries): void => {
    if (
        series.schemaVersion !== 1
        || !isFeatureId(series.featureId)
        || !Number.isFinite(series.sampleStepSeconds)
        || series.sampleStepSeconds <= 0
        || !Number.isInteger(series.sampleCount)
        || series.sampleCount < 0
        || series.dimensions.some((value) =>
            !Number.isInteger(value) || value <= 0)
    ) {
        throw new Error('Analysis series metadata is invalid.');
    }
    const payload = series.payload;
    if ((series.featureId === 'wallpaperEngineSpectrum') !== (payload.kind === 'stereo-spectrum-f32')) throw new Error('Stereo spectrum feature/payload mismatch.');
    switch (payload.kind) {
        case 'stereo-spectrum-f32':
            if (payload.width !== 128 || series.dimensions.length !== 1 || series.dimensions[0] !== 128
                || series.sampleStepSeconds !== 1 / 30 || series.sampleCount <= 0
                || payload.values.length !== series.sampleCount * 128 || !(payload.values instanceof Float32Array)
                || payload.values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Stereo spectrum payload is invalid.');
            break;
        case 'scalar-f32':
            if (payload.values.length !== series.sampleCount) {
                throw new Error('Scalar payload length does not match.');
            }
            assertFiniteValues(payload.values);
            break;
        case 'frequency-u16':
        case 'category-u16':
            if (
                payload.width !== dimensionWidth(series.dimensions)
                || payload.values.length
                    !== series.sampleCount * payload.width
                || !Number.isFinite(payload.scale)
                || payload.scale < 0
                || !Number.isFinite(payload.offset)
            ) {
                throw new Error('Vector payload dimensions do not match.');
            }
            break;
        case 'waveform-envelope':
            if (
                payload.min.length !== series.sampleCount
                || payload.max.length !== series.sampleCount
                || !Number.isFinite(payload.scale)
                || payload.scale < 0
            ) {
                throw new Error('Waveform payload dimensions do not match.');
            }
            break;
        case 'loudness':
            if (
                payload.total.length !== series.sampleCount
                || payload.specific.length !== series.sampleCount * 24
                || !Number.isFinite(payload.scale)
                || payload.scale < 0
                || !Number.isFinite(payload.offset)
            ) {
                throw new Error('Loudness payload dimensions do not match.');
            }
            assertFiniteValues(payload.total);
            break;
        case 'complex-derived':
            if (
                payload.bins !== dimensionWidth(series.dimensions) / 2
                || payload.magnitude.length
                    !== series.sampleCount * payload.bins
                || payload.phase.length
                    !== series.sampleCount * payload.bins
                || !Number.isFinite(payload.magnitudeScale)
                || payload.magnitudeScale < 0
            ) {
                throw new Error('Complex payload dimensions do not match.');
            }
            break;
    }
};
