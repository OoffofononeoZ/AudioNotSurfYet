import { WALLPAPER_SPECTRUM_IDENTITY } from '../../src/analysis/wallpaperSpectrum';
import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';
import {
    aggregateComplex,
    aggregateScalars,
    aggregateVectors,
    aggregateWaveform,
    decodeAnalysisSeries,
    dequantizeUint16,
    encodeAnalysisSeries,
    quantizeToUint16,
} from '../../src/analysis/compactCodec';
import {
    canonicalAnalysisConfig,
    createAnalysisCacheKey,
    createAnalysisConfig,
} from '../../src/analysis/config';
import {
    analysisFrameCount,
    createAnalysisFrame,
    cursorFrameIndex,
    frameStartSeconds,
} from '../../src/analysis/frames';
import {
    FEATURE_REGISTRY,
    validateFeatureRegistry,
} from '../../src/analysis/featureRegistry';
import {
    averageToMono,
    copyDecodedAudioToMono,
    PcmCopyError,
} from '../../src/analysis/pcm';
import {
    FEATURE_IDS,
    M10_AVAILABLE_FEATURE_IDS,
    type AnalysisSeries,
    type CompactPayload,
    type FeatureId,
} from '../../src/analysis/types';
import { analyzerData } from '../../src/data/analyzerData';

describe('M6 feature registry and identity', () => {
    test('is bidirectionally exhaustive for all registered analyzer entries', async () => {
        const config = await createAnalysisConfig(48_000);
        expect(Object.keys(FEATURE_REGISTRY)).toEqual([...FEATURE_IDS]);
        expect(analyzerData.map(({ abbreviation }) => abbreviation))
            .toEqual([...FEATURE_IDS]);
        expect(new Set(FEATURE_IDS)).toHaveLength(22);
        expect(() => validateFeatureRegistry(config)).not.toThrow();
        expect(new Set(
            FEATURE_IDS.filter((id) =>
                FEATURE_REGISTRY[id].workerSupported),
        )).toEqual(new Set([...M10_AVAILABLE_FEATURE_IDS, 'wallpaperEngineSpectrum']));

        for (const featureId of FEATURE_IDS) {
            const definition = FEATURE_REGISTRY[featureId];
            expect(definition.id).toBe(featureId);
            expect(definition.meydaKey).toBe(featureId);
            expect(definition.deliveryMilestone).toMatch(/^M(7|8|9|10)$/);
            expect(definition.label).not.toBe('');
            expect(definition.description).not.toBe('');
        }
    });

    test('uses Meyda 5.6.3 runtime dimensions', async () => {
        const config = await createAnalysisConfig(48_000);
        expect(FEATURE_REGISTRY.amplitudeSpectrum.dimensions(config))
            .toEqual([512]);
        expect(FEATURE_REGISTRY.powerSpectrum.dimensions(config))
            .toEqual([512]);
        expect(FEATURE_REGISTRY.chroma.dimensions(config)).toEqual([12]);
        expect(FEATURE_REGISTRY.mfcc.dimensions(config)).toEqual([13]);
        expect(FEATURE_REGISTRY.buffer.dimensions(config)).toEqual([1024]);
        expect(FEATURE_REGISTRY.loudness.dimensions(config))
            .toEqual([24, 1]);
        expect(FEATURE_REGISTRY.complexSpectrum.dimensions(config))
            .toEqual([1024, 2]);
    });

    test('hashes the fixed config canonically and keys every identity field', async () => {
        expect(canonicalAnalysisConfig(48_000)).toBe(
            'analysis-config:v1|frame=1024|hop=512|window=hanning'
            + '|mfcc=13|channel=average-mono|sampleRate=48000|' + WALLPAPER_SPECTRUM_IDENTITY,
        );
        const first = await createAnalysisConfig(48_000);
        const same = await createAnalysisConfig(48_000);
        const changed = await createAnalysisConfig(44_100);
        expect(first.configHash).toMatch(/^[a-f0-9]{64}$/);
        expect(first.configHash).toBe(same.configHash);
        expect(changed.configHash).not.toBe(first.configHash);
        expect(createAnalysisCacheKey(
            'track-hash',
            first.configHash,
            'rms',
        )).toBe(`track-hash:${first.configHash}:rms`);
    });
});

describe('M6 PCM and frame planning', () => {
    test('averages mono, stereo and multichannel PCM without mutating input', () => {
        const mono = new Float32Array([0.25, -0.5]);
        const monoResult = averageToMono([mono]);
        expect([...monoResult]).toEqual([0.25, -0.5]);
        expect(monoResult).not.toBe(mono);
        expect([...averageToMono([
            new Float32Array([1, -1]),
            new Float32Array([-1, 1]),
        ])]).toEqual([0, 0]);
        expect([...averageToMono([
            new Float32Array([1, 4]),
            new Float32Array([2, 5]),
            new Float32Array([3, 6]),
        ])]).toEqual([2, 5]);
        expect(() => averageToMono([])).toThrow(PcmCopyError);
        expect(() => averageToMono([
            new Float32Array([1]),
            new Float32Array([1, 2]),
        ])).toThrow(/lengths must match/);
    });

    test('copies decoded channels in chunks, yields, and rejects revision drift', async () => {
        const channels = [
            new Float32Array([1, 2, 3, 4, 5]),
            new Float32Array([5, 4, 3, 2, 1]),
        ];
        let revision = 7;
        const yieldControl = vi.fn(async () => undefined);
        const engine = {
            getDecodedAudioDescriptor: () => ({
                trackId: 'track-1',
                revision,
                sampleRate: 5,
                length: 5,
                channelCount: 2,
                durationSeconds: 1,
            }),
            copyDecodedChannelRange: ({
                revision: requestedRevision,
                channel,
                start,
                length,
            }: {
                revision: number;
                channel: number;
                start: number;
                length: number;
            }) => requestedRevision === revision
                ? channels[channel]!.slice(start, start + length)
                : null,
        };
        const copied = await copyDecodedAudioToMono(engine, {
            chunkSize: 2,
            yieldControl,
        });
        expect([...copied.pcm]).toEqual([3, 3, 3, 3, 3]);
        expect(yieldControl).toHaveBeenCalledTimes(3);

        let yields = 0;
        await expect(copyDecodedAudioToMono(engine, {
            chunkSize: 2,
            yieldControl: async () => {
                yields += 1;
                if (yields === 1) revision += 1;
            },
        })).rejects.toMatchObject({ code: 'stale' });
    });

    test('plans short, exact, hop-boundary and zero-padded tail frames', () => {
        expect(analysisFrameCount(1)).toBe(1);
        expect(analysisFrameCount(1024)).toBe(1);
        expect(analysisFrameCount(1025)).toBe(2);
        expect(analysisFrameCount(1536)).toBe(2);
        const config = {
            frameSize: 1024 as const,
            hopSize: 512 as const,
        };
        const pcm = new Float32Array(1025);
        pcm[1024] = 0.75;
        const tail = createAnalysisFrame(pcm, 1, config);
        expect(tail).toHaveLength(1024);
        expect(tail[512]).toBe(0.75);
        expect(tail[513]).toBe(0);
        expect(frameStartSeconds(2, {
            hopSize: 512,
            sampleRate: 48_000,
        })).toBeCloseTo(1024 / 48_000);
        expect(cursorFrameIndex(1, 1, 3, {
            hopSize: 512,
            sampleRate: 1024,
        })).toBe(2);
    });
});

const series = (
    featureId: FeatureId,
    payload: CompactPayload,
    dimensions: readonly number[],
    sampleCount = 2,
): AnalysisSeries => ({
    schemaVersion: 1,
    trackHash: 'track-hash',
    configHash: 'config-hash',
    featureId,
    startTimeSeconds: 0,
    sampleStepSeconds: 1 / 30,
    sampleCount,
    dimensions,
    payload,
});

describe('M6 aggregation, quantization and six-shape cache codec', () => {
    test('aggregates scalars/vectors, waveform and complex phase correctly', () => {
        expect([...aggregateScalars([1, 3, 5], 2)]).toEqual([2, 5]);
        expect([...aggregateVectors([
            [1, 3],
            [3, 5],
            [9, 11],
        ], 2, 2)]).toEqual([2, 4, 9, 11]);

        const waveform = aggregateWaveform([
            [-1, 0.5],
            [-0.25, 0.75],
        ], 2);
        expect(waveform.min[0]! * waveform.scale).toBeCloseTo(-1, 4);
        expect(waveform.max[0]! * waveform.scale).toBeCloseTo(0.75, 4);

        const complex = aggregateComplex([
            { real: [1, 0], imag: [0, 1] },
            { real: [0, -1], imag: [1, 0] },
        ], 2, 2);
        expect(complex.magnitude).toHaveLength(2);
        expect(complex.phase).toHaveLength(2);
    });

    test('quantizes actual ranges, round-trips constants, and rejects clipping', () => {
        const quantized = quantizeToUint16([-1, 0, 1]);
        const restored = dequantizeUint16(
            quantized.values,
            quantized.scale,
            quantized.offset,
        );
        expect(restored[0]).toBeCloseTo(-1, 5);
        expect(restored[1]).toBeCloseTo(0, 4);
        expect(restored[2]).toBeCloseTo(1, 5);

        const constant = quantizeToUint16([4, 4, 4]);
        expect(constant.scale).toBe(0);
        expect([...dequantizeUint16(
            constant.values,
            constant.scale,
            constant.offset,
        )]).toEqual([4, 4, 4]);
        expect(() => quantizeToUint16([-1, 2], {
            min: 0,
            max: 1,
        })).toThrow(/bounds/);
    });

    test.each([
        series('rms', {
            kind: 'scalar-f32',
            values: new Float32Array([0.1, 0.2]),
        }, []),
        series('amplitudeSpectrum', {
            kind: 'frequency-u16',
            values: new Uint16Array([0, 1, 2, 3]),
            width: 2,
            scale: 0.1,
            offset: 0,
        }, [2]),
        series('chroma', {
            kind: 'category-u16',
            values: new Uint16Array([0, 1, 2, 3]),
            width: 2,
            scale: 0.1,
            offset: 0,
        }, [2]),
        series('buffer', {
            kind: 'waveform-envelope',
            min: new Int16Array([-2, -1]),
            max: new Int16Array([1, 2]),
            scale: 0.5,
        }, [1024]),
        series('loudness', {
            kind: 'loudness',
            total: new Float32Array([1, 2]),
            specific: new Uint16Array(48),
            bands: 24,
            scale: 0.01,
            offset: 0,
        }, [24, 1]),
        series('complexSpectrum', {
            kind: 'complex-derived',
            magnitude: new Uint16Array(8),
            phase: new Int16Array(8),
            bins: 4,
            magnitudeScale: 0.01,
        }, [4, 2]),
    ])('round-trips $payload.kind without trailing data', (input) => {
        const decoded = decodeAnalysisSeries(
            encodeAnalysisSeries(input),
            {
                trackHash: input.trackHash,
                configHash: input.configHash,
                featureId: input.featureId,
            },
        );
        expect(decoded).toEqual(input);
    });

    test('rejects identity mismatch, truncated, misaligned and trailing bytes', () => {
        const encoded = encodeAnalysisSeries(series('rms', {
            kind: 'scalar-f32',
            values: new Float32Array([1, 2]),
        }, []));
        expect(() => decodeAnalysisSeries(encoded, {
            trackHash: 'wrong',
            configHash: 'config-hash',
            featureId: 'rms',
        })).toThrow(/identity/);
        expect(() => decodeAnalysisSeries(encoded.slice(0, -1)))
            .toThrow();

        const trailing = new Uint8Array(encoded.byteLength + 1);
        trailing.set(new Uint8Array(encoded));
        expect(() => decodeAnalysisSeries(trailing.buffer))
            .toThrow(/trailing/);

        const headerLength = new DataView(encoded).getUint32(0, true);
        const header = JSON.parse(new TextDecoder().decode(
            new Uint8Array(encoded, 4, headerLength),
        )) as { ranges: Array<{ offset: number }> };
        header.ranges[0]!.offset = 1;
        const replacement = new TextEncoder().encode(JSON.stringify(header));
        expect(replacement).toHaveLength(headerLength);
        const misaligned = encoded.slice(0);
        new Uint8Array(misaligned, 4, headerLength).set(replacement);
        expect(() => decodeAnalysisSeries(misaligned))
            .toThrow(/byte range/);
    });
});
