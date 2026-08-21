import { analyzerData } from '../data/analyzerData';
import {
    FEATURE_IDS,
    type AnalysisConfig,
    type FeatureDefinition,
    type FeatureId,
} from './types';

type DefinitionInput = Omit<
    FeatureDefinition,
    'id' | 'meydaKey' | 'label' | 'description' | 'extractionSource'
> & Pick<
    Partial<FeatureDefinition>,
    'extractionSource'
>;

const details = new Map(
    analyzerData.map((entry) => [entry.abbreviation, entry]),
);

const defineFeature = <T extends FeatureId>(
    id: T,
    input: DefinitionInput,
): FeatureDefinition<T> => {
    const detail = details.get(id);
    if (!detail) {
        throw new Error(`Missing analyzerData entry for ${id}.`);
    }
    return {
        id,
        meydaKey: id,
        label: detail.title,
        description: detail.detail.description,
        extractionSource: 'meyda',
        ...input,
    };
};

const scalar = (
    id: FeatureId,
    input: Omit<
        DefinitionInput,
        'outputShape' | 'renderer' | 'dimensions'
    >,
) => defineFeature(id, {
    ...input,
    outputShape: 'scalar',
    renderer: 'scalar-line',
    dimensions: () => [],
});

export const FEATURE_REGISTRY = {
    rms: scalar('rms', {
        range: { min: 0 },
        dependencies: [],
        deliveryMilestone: 'M7',
        workerSupported: true,
    }),
    zcr: scalar('zcr', {
        range: { min: 0 },
        dependencies: [],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    energy: scalar('energy', {
        range: { min: 0 },
        dependencies: [],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    amplitudeSpectrum: defineFeature('amplitudeSpectrum', {
        outputShape: 'frequency-vector',
        renderer: 'frequency-heatmap',
        range: { min: 0 },
        dependencies: [],
        dimensions: (config) => [config.frameSize / 2],
        deliveryMilestone: 'M7',
        workerSupported: true,
    }),
    powerSpectrum: defineFeature('powerSpectrum', {
        outputShape: 'frequency-vector',
        renderer: 'frequency-heatmap',
        range: { min: 0 },
        dependencies: ['amplitudeSpectrum'],
        dimensions: (config) => [config.frameSize / 2],
        deliveryMilestone: 'M9',
        workerSupported: false,
    }),
    spectralCentroid: scalar('spectralCentroid', {
        range: { min: 0, unit: 'bin' },
        dependencies: ['amplitudeSpectrum'],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    spectralFlatness: scalar('spectralFlatness', {
        range: { min: 0, max: 1 },
        dependencies: ['amplitudeSpectrum'],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    spectralFlux: scalar('spectralFlux', {
        range: { min: 0 },
        dependencies: ['amplitudeSpectrum'],
        deliveryMilestone: 'M8',
        workerSupported: true,
        extractionSource: 'project-spectral-flux-v1',
        zeroEnergyValue: 0,
    }),
    spectralSlope: scalar('spectralSlope', {
        range: { signed: true },
        dependencies: ['amplitudeSpectrum'],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    spectralRolloff: scalar('spectralRolloff', {
        range: { min: 0, unit: 'Hz' },
        dependencies: ['amplitudeSpectrum'],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    spectralSpread: scalar('spectralSpread', {
        range: { min: 0, unit: 'bin' },
        dependencies: ['amplitudeSpectrum', 'spectralCentroid'],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    spectralSkewness: scalar('spectralSkewness', {
        range: { signed: true },
        dependencies: ['amplitudeSpectrum', 'spectralCentroid'],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    spectralKurtosis: scalar('spectralKurtosis', {
        range: { min: 0 },
        dependencies: ['amplitudeSpectrum', 'spectralCentroid'],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    spectralCrest: scalar('spectralCrest', {
        range: { min: 0 },
        dependencies: ['amplitudeSpectrum'],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    chroma: defineFeature('chroma', {
        outputShape: 'category-vector',
        renderer: 'chroma-heatmap',
        range: { min: 0, max: 1 },
        dependencies: ['amplitudeSpectrum'],
        dimensions: () => [12],
        deliveryMilestone: 'M7',
        workerSupported: true,
    }),
    loudness: defineFeature('loudness', {
        outputShape: 'loudness-structure',
        renderer: 'loudness',
        range: { min: 0 },
        dependencies: ['amplitudeSpectrum'],
        dimensions: () => [24, 1],
        deliveryMilestone: 'M10',
        workerSupported: false,
    }),
    perceptualSpread: scalar('perceptualSpread', {
        range: { min: 0, max: 1 },
        dependencies: ['loudness'],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    perceptualSharpness: scalar('perceptualSharpness', {
        range: { min: 0 },
        dependencies: ['loudness'],
        deliveryMilestone: 'M8',
        workerSupported: true,
        zeroEnergyValue: 0,
    }),
    mfcc: defineFeature('mfcc', {
        outputShape: 'frequency-vector',
        renderer: 'frequency-heatmap',
        range: { signed: true },
        dependencies: ['amplitudeSpectrum', 'powerSpectrum'],
        dimensions: (config) => [config.numberOfMFCCCoefficients],
        deliveryMilestone: 'M9',
        workerSupported: false,
    }),
    complexSpectrum: defineFeature('complexSpectrum', {
        outputShape: 'complex-spectrum',
        renderer: 'complex-spectrum',
        range: { signed: true },
        dependencies: [],
        dimensions: (config) => [config.frameSize, 2],
        deliveryMilestone: 'M10',
        workerSupported: false,
    }),
    buffer: defineFeature('buffer', {
        outputShape: 'waveform',
        renderer: 'waveform',
        range: { min: -1, max: 1, signed: true },
        dependencies: [],
        dimensions: (config) => [config.frameSize],
        deliveryMilestone: 'M9',
        workerSupported: false,
    }),
} as const satisfies Record<FeatureId, FeatureDefinition>;

export const getFeatureDefinition = <T extends FeatureId>(
    featureId: T,
): FeatureDefinition<T> =>
    FEATURE_REGISTRY[featureId] as FeatureDefinition<T>;

export const validateFeatureRegistry = (
    config: AnalysisConfig,
): void => {
    const sourceIds = analyzerData.map((entry) => entry.abbreviation);
    const uniqueSourceIds = new Set(sourceIds);
    if (
        sourceIds.length !== FEATURE_IDS.length
        || uniqueSourceIds.size !== FEATURE_IDS.length
    ) {
        throw new Error(
            'analyzerData abbreviations must contain 21 unique entries.',
        );
    }

    const expected = new Set<string>(FEATURE_IDS);
    for (const id of sourceIds) {
        if (!expected.delete(id)) {
            throw new Error(`Unexpected or duplicate analyzer feature: ${id}.`);
        }
    }
    if (expected.size > 0) {
        throw new Error(
            `Missing analyzer features: ${[...expected].join(', ')}.`,
        );
    }

    for (const id of FEATURE_IDS) {
        const definition = FEATURE_REGISTRY[id];
        const dimensions = definition.dimensions(config);
        if (
            definition.id !== id
            || definition.meydaKey !== id
            || dimensions.some((value) =>
                !Number.isInteger(value) || value <= 0)
        ) {
            throw new Error(`Invalid feature registry entry: ${id}.`);
        }
    }
};
