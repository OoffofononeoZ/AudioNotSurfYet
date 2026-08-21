import { readFile } from 'node:fs/promises';
import {
    describe,
    expect,
    test,
} from 'vitest';
import { FEATURE_REGISTRY } from '../../src/analysis/featureRegistry';
import {
    extractM8Frame,
    spectralFluxV1,
} from '../../src/analysis/meydaAdapter';
import { scalarPlotDomain } from '../../src/analysis/rendererData';
import {
    M8_AVAILABLE_FEATURE_IDS,
    M8_SCALAR_FEATURE_IDS,
} from '../../src/analysis/types';
import { M8_SCALAR_GOLDEN_PATH } from './generate-m8-scalar-golden';
import {
    buildM8ScalarGolden,
    createM8ScalarFrames,
    M8_TEST_CONFIG,
} from '../support/m8-scalar-fixture';
import { assertMeydaValueClose } from '../support/tolerance';

describe('M8 scalar registry and extraction contract', () => {
    test('opens exactly 13 scalar features and 16 total M8 features', () => {
        expect(M8_SCALAR_FEATURE_IDS).toHaveLength(13);
        expect(new Set(M8_AVAILABLE_FEATURE_IDS)).toHaveLength(16);
        for (const featureId of M8_SCALAR_FEATURE_IDS) {
            expect(FEATURE_REGISTRY[featureId]).toMatchObject({
                outputShape: 'scalar',
                renderer: 'scalar-line',
                deliveryMilestone: 'M8',
                workerSupported: true,
                zeroEnergyValue: 0,
            });
        }
        expect(FEATURE_REGISTRY.spectralFlux.extractionSource)
            .toBe('project-spectral-flux-v1');
        expect(M8_SCALAR_FEATURE_IDS.filter((id) =>
            FEATURE_REGISTRY[id].extractionSource === 'meyda'))
            .toHaveLength(12);
    });

    test('implements positive-difference Flux with a zero first frame', () => {
        expect(spectralFluxV1([2, 3, 1])).toBe(0);
        expect(spectralFluxV1([2, 3, 1], [1, 5, 0.5])).toBe(1.5);
        expect(() => spectralFluxV1([1], [1, 2])).toThrow(/dimensions/);
        expect(() => spectralFluxV1([Number.NaN], [0]))
            .toThrow(/non-finite/);
    });

    test('returns project zeros for every M8 scalar on silence', () => {
        const silence = createM8ScalarFrames()[0]!.frame;
        const result = extractM8Frame(
            M8_SCALAR_FEATURE_IDS,
            silence,
            M8_TEST_CONFIG,
        ).values;
        for (const featureId of M8_SCALAR_FEATURE_IDS) {
            expect(result[featureId], featureId).toBe(0);
        }
    });

    test('fails explicitly when non-silent extraction becomes non-finite', () => {
        const frame = createM8ScalarFrames()[1]!.frame.slice();
        frame[10] = Number.NaN;
        expect(() => extractM8Frame(['spectralCentroid'], frame, M8_TEST_CONFIG))
            .toThrow(/invalid scalar/);
    });

    test('computes fixed, non-negative and signed scalar plot domains', () => {
        expect(scalarPlotDomain([0.2, 0.8], { min: 0, max: 1 }))
            .toEqual({ min: 0, max: 1 });
        expect(scalarPlotDomain([2, 4], { min: 0 }))
            .toEqual({ min: 0, max: 4 });
        expect(scalarPlotDomain([-2, 3], { signed: true }))
            .toEqual({ min: -2, max: 3 });
        expect(scalarPlotDomain([0, 0], { min: 0 }).max)
            .toBeGreaterThan(0);
    });
});

describe('M8 versioned scalar golden', () => {
    test('matches direct Meyda, project Flux and fixture hashes', async () => {
        const committed = JSON.parse(
            await readFile(M8_SCALAR_GOLDEN_PATH, 'utf8'),
        ) as ReturnType<typeof buildM8ScalarGolden>;
        const direct = buildM8ScalarGolden();
        expect(committed).toEqual(direct);

        let previousAmplitudeSpectrum: number[] | undefined;
        createM8ScalarFrames().forEach((fixture, caseIndex) => {
            const result = extractM8Frame(
                M8_SCALAR_FEATURE_IDS,
                fixture.frame,
                M8_TEST_CONFIG,
                previousAmplitudeSpectrum,
            );
            previousAmplitudeSpectrum = result.amplitudeSpectrum;
            for (const featureId of M8_SCALAR_FEATURE_IDS) {
                assertMeydaValueClose(
                    result.values[featureId] as number,
                    committed.cases[caseIndex]!.expected[featureId],
                    `${fixture.id}.${featureId}`,
                );
            }
        });
    });

    test('encodes the intended M8 learning relationships', () => {
        const [silence, pure, rich, noise] = buildM8ScalarGolden().cases;
        expect(Object.values(silence!.expected).every((value) => value === 0))
            .toBe(true);
        expect(rich!.expected.spectralCentroid)
            .toBeGreaterThan(pure!.expected.spectralCentroid);
        expect(rich!.expected.perceptualSharpness)
            .toBeGreaterThan(pure!.expected.perceptualSharpness);
        expect(noise!.expected.spectralFlatness)
            .toBeGreaterThan(pure!.expected.spectralFlatness);
        expect(noise!.expected.zcr).toBeGreaterThan(pure!.expected.zcr);
        expect(noise!.expected.spectralFlux).toBeGreaterThan(0);
    });
});
