import type { ExactFeatureValue, FeatureId } from '../analysis/types';
import type { NativeAudioFrame } from './nativeAudioAnalysis';
import type { RealtimeStyleV2 } from './realtimeStyle';
import type { VisualizerResolvedParameterMap } from './rendererTypes';
import type { VisualizerAnalysisComponent } from './types';
import { projectRawValue } from './analysisProjection';
import { analysisSignal } from './analysisSignal';
import { normalizedTarget, outputValue } from './bindingSmoothing';
import { parameterKey } from './compositionEffects';
import { findResource } from './elementRegistry';

export function silentFeatureValue(id: FeatureId): ExactFeatureValue {
    if (id === 'loudness') return { total: 0, specific: Array(24).fill(0) };
    if (id === 'complexSpectrum') return { real: Array(1024).fill(0), imag: Array(1024).fill(0) };
    const width =
        id === 'wallpaperEngineSpectrum'
            ? 128
            : ['amplitudeSpectrum', 'powerSpectrum'].includes(id)
              ? 512
              : id === 'chroma'
                ? 12
                : id === 'mfcc'
                  ? 13
                  : id === 'buffer'
                    ? 1024
                    : 0;
    return width ? Array(width).fill(0) : 0;
}
function componentValue(raw: ExactFeatureValue, component: VisualizerAnalysisComponent): number | number[] {
    if (typeof raw === 'number' || Array.isArray(raw)) {
        if (component !== 'default') throw Error('实时输入分量无效。');
        return raw;
    }
    if ('total' in raw) {
        if (component === 'total') return raw.total;
        if (component === 'specific') return raw.specific;
    } else {
        if (component === 'real') return raw.real;
        if (component === 'imag') return raw.imag;
        if (component === 'magnitude') return raw.real.map((v, i) => Math.hypot(v, raw.imag[i]!));
        if (component === 'phase') return raw.real.map((v, i) => Math.atan2(raw.imag[i]!, v));
    }
    throw Error('实时输入分量无效。');
}
/** Current-frame projection plus finite attack/release state; no absolute-time history reconstruction. */
export class RealtimeResolver {
    private smoothing = new Map<string, { time: number; value: number }>();
    reset() {
        this.smoothing.clear();
    }
    resolve(
        style: RealtimeStyleV2,
        time: number,
        features: Partial<Record<FeatureId, ExactFeatureValue>>,
        native: NativeAudioFrame | null,
    ): VisualizerResolvedParameterMap {
        const result = new Map();
        for (const element of style.elements) {
            const definition = findResource(style.resources.elements, element.resource);
            for (const binding of element.bindings) {
                const key = parameterKey(element.id, binding.parameterId),
                    parameter = definition.parameters.find(p => p.id === binding.parameterId)!;
                const source = binding.source;
                if (source.kind === 'constant') {
                    result.set(key, { parameterId: binding.parameterId, state: 'ready', value: source.value });
                    continue;
                }
                if (source.kind === 'unbound') throw Error('实时输入未配置。');
                let value: number | number[], unit: string, channelLayout: string;
                if (source.kind === 'native') {
                    value = native?.[source.featureId] ?? Array(2048).fill(0);
                    unit = source.featureId === 'frequency' ? 'byte-frequency' : 'signed-waveform';
                    channelLayout = source.featureId === 'frequency' ? 'stereo-1024' : 'mono';
                } else {
                    const raw = componentValue(
                        features[source.featureId] ?? silentFeatureValue(source.featureId),
                        source.component ?? 'default',
                    );
                    value = projectRawValue(raw, source.projection);
                    unit = source.featureId === 'wallpaperEngineSpectrum' ? 'we-strength' : 'meyda-amplitude';
                    channelLayout = source.featureId === 'wallpaperEngineSpectrum' ? 'stereo-64' : 'mono';
                    if (binding.transform) {
                        const transform = binding.transform;
                        if (Array.isArray(value))
                            value = value.map(v => outputValue(normalizedTarget(v, transform), transform, parameter));
                        else {
                            const target = normalizedTarget(value, transform),
                                previous = this.smoothing.get(key) ?? { time, value: 0 };
                            const tau = target > previous.value ? transform.attackSeconds : transform.releaseSeconds;
                            const alpha = tau <= 0 ? 1 : 1 - Math.exp(-Math.max(0, time - previous.time) / tau);
                            const state = previous.value + (target - previous.value) * alpha;
                            this.smoothing.set(key, { time, value: state });
                            value = outputValue(state, transform, parameter);
                        }
                    } else if (Array.isArray(value)) value = analysisSignal(value, source.featureId);
                    else
                        value = Math.max(
                            parameter.range?.min ?? -Infinity,
                            Math.min(parameter.range?.max ?? Infinity, value),
                        );
                }
                if ((Array.isArray(value) ? value : [value]).some(v => !Number.isFinite(v)))
                    throw Error('实时输入包含非有限值。');
                result.set(key, { parameterId: binding.parameterId, state: 'ready', value, unit, channelLayout });
            }
        }
        return result;
    }
}
