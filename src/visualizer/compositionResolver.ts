import type { AnalysisSeries, FeatureId } from '../analysis/types';
import { projectAnalysisSeries } from './analysisProjection';
import { analysisSignal } from './analysisSignal';
import { ScalarSmoothingResolver, normalizedTarget, outputValue } from './bindingSmoothing';
import { elementDescriptor, elementAlgorithm, effectiveElements } from './compositionModel';
import type { VisualizerResolvedParameter } from './rendererTypes';
import type { VisualizerProjectV5 } from './compositionTypes';
import type { NativeInputFeature } from './nativeAudioAnalysis';
export type ResolvedComposition = ReadonlyMap<string, ReadonlyMap<string, VisualizerResolvedParameter>>;

export class CompositionResolver {
    private smoothers = new Map<string, ScalarSmoothingResolver>();
    reset() {
        this.smoothers.clear();
    }
    resolve(
        project: VisualizerProjectV5,
        time: number,
        getSeries: (id: FeatureId, stemRole?: import('../processing/modelManifest').StemRole) => AnalysisSeries | null,
        getWaveform?: (
            time: number,
            stemRole?: import('../processing/modelManifest').StemRole,
        ) => readonly number[] | null,
        getNative?: (feature: NativeInputFeature, time: number, history: boolean) => number[] | null,
    ): ResolvedComposition {
        const result = new Map<string, Map<string, VisualizerResolvedParameter>>();
        for (const e of effectiveElements(project).filter(e => e.enabled)) {
            const values = new Map<string, VisualizerResolvedParameter>();
            result.set(e.id, values);
            const descriptor = elementDescriptor(project, e);
            for (const binding of e.bindings) {
                const parameter = descriptor.parameters.find(p => p.id === binding.parameterId)!;
                const parameterId = binding.parameterId;
                try {
                    if (binding.source.kind === 'unbound') {
                        values.set(parameterId, { parameterId, state: 'error', message: '输入未配置' });
                        continue;
                    }
                    if (binding.source.kind === 'constant') {
                        values.set(parameterId, { parameterId, state: 'ready', value: binding.source.value });
                        continue;
                    }
                    if (binding.source.kind === 'native') {
                        const value = getNative?.(
                            binding.source.featureId,
                            time,
                            elementAlgorithm(project, e).contract.historyParameters.includes(parameterId),
                        );
                        values.set(
                            parameterId,
                            value
                                ? {
                                      parameterId,
                                      state: 'ready',
                                      value,
                                      unit:
                                          binding.source.featureId === 'frequency'
                                              ? 'byte-frequency'
                                              : 'signed-waveform',
                                      channelLayout: binding.source.featureId === 'frequency' ? 'stereo-1024' : 'mono',
                                  }
                                : { parameterId, state: 'loading', message: '原生输入准备中' },
                        );
                        continue;
                    }
                    const source = binding.source;
                    const series = getSeries(source.featureId, source.stemRole);
                    if (!series || series.trackHash !== project.track.contentHash) {
                        values.set(parameterId, { parameterId, state: 'loading', message: '等待分析数据' });
                        continue;
                    }
                    const sample = (at: number) =>
                        projectAnalysisSeries(
                            series,
                            source.component ?? 'default',
                            source.projection,
                            at,
                            source.featureId === 'buffer' ? getWaveform?.(at, source.stemRole) : undefined,
                        );
                    const raw = sample(time);
                    let value: number | number[];
                    const transform = binding.transform;
                    if (!transform)
                        value = Array.isArray(raw)
                            ? analysisSignal(raw, source.featureId)
                            : Math.max(
                                  parameter.range?.min ?? -Infinity,
                                  Math.min(parameter.range?.max ?? Infinity, raw),
                              );
                    else if (Array.isArray(raw))
                        value = raw.map(n => outputValue(normalizedTarget(n, transform), transform, parameter));
                    else {
                        const key = e.id + ':' + parameterId + ':' + JSON.stringify(binding);
                        let smoother = this.smoothers.get(key);
                        if (!smoother) {
                            smoother = new ScalarSmoothingResolver(
                                at => {
                                    const n = sample(at);
                                    if (typeof n !== 'number') throw Error('平滑需要标量');
                                    return n;
                                },
                                transform,
                                parameter,
                            );
                            this.smoothers.set(key, smoother);
                        }
                        value = smoother.resolve(time);
                    }
                    values.set(parameterId, {
                        parameterId,
                        state: 'ready',
                        value,
                        unit: source.featureId === 'wallpaperEngineSpectrum' ? 'we-strength' : 'meyda-amplitude',
                        channelLayout: source.featureId === 'wallpaperEngineSpectrum' ? 'stereo-64' : 'mono',
                    });
                } catch (error) {
                    values.set(parameterId, { parameterId, state: 'error', message: (error as Error).message });
                }
            }
        }
        return result;
    }
}
