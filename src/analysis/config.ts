import type { AnalysisConfig, ConfigHash, FeatureId } from './types';
import { WALLPAPER_SPECTRUM_IDENTITY } from './wallpaperSpectrum';

export const ANALYSIS_CONFIG_PREFIX = 'analysis-config:v1';

export const canonicalAnalysisConfig = (sampleRate: number): string => {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        throw new RangeError('Analysis sample rate must be positive.');
    }
    return [
        ANALYSIS_CONFIG_PREFIX,
        'frame=1024',
        'hop=512',
        'window=hanning',
        'mfcc=13',
        'channel=average-mono',
        `sampleRate=${sampleRate}`,
        WALLPAPER_SPECTRUM_IDENTITY,
    ].join('|');
};

export const sha256Text = async (value: string): Promise<string> => {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(value),
    );
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
};

export const createAnalysisConfig = async (
    sampleRate: number,
): Promise<AnalysisConfig> => ({
    schemaVersion: 1,
    frameSize: 1024,
    hopSize: 512,
    windowingFunction: 'hanning',
    numberOfMFCCCoefficients: 13,
    channelMode: 'average-mono',
    sampleRate,
    configHash: await sha256Text(canonicalAnalysisConfig(sampleRate)),
});

export const validateAnalysisConfig = async (
    config: AnalysisConfig,
): Promise<boolean> => {
    if (
        config.schemaVersion !== 1
        || config.frameSize !== 1024
        || config.hopSize !== 512
        || config.windowingFunction !== 'hanning'
        || config.numberOfMFCCCoefficients !== 13
        || config.channelMode !== 'average-mono'
        || !Number.isFinite(config.sampleRate)
        || config.sampleRate <= 0
        || typeof config.configHash !== 'string'
    ) {
        return false;
    }
    return config.configHash
        === await sha256Text(canonicalAnalysisConfig(config.sampleRate));
};

export const createAnalysisCacheKey = (
    trackHash: string,
    configHash: ConfigHash,
    featureId: FeatureId,
): string => `${trackHash}:${configHash}:${featureId}`;
