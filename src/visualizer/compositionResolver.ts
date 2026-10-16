import type { AnalysisSeries, FeatureId } from '../analysis/types';
import { projectAnalysisSeries } from './analysisProjection';
import { analysisSignal } from './analysisSignal';
import { ScalarSmoothingResolver, normalizedTarget, outputValue } from './bindingSmoothing';
import { elementRegistry } from './elementRegistry';
import type { VisualizerResolvedParameter } from './rendererTypes';
import type { VisualizerProjectV3 } from './compositionTypes';
export type ResolvedComposition = ReadonlyMap<string, ReadonlyMap<string, VisualizerResolvedParameter>>;

export class CompositionResolver {
    private smoothers = new Map<string, ScalarSmoothingResolver>();
    reset() { this.smoothers.clear(); }
    resolve(project: VisualizerProjectV3, time: number, getSeries: (id:FeatureId) => AnalysisSeries | null, getWaveform?: (time:number) => readonly number[] | null): ResolvedComposition {
        const result=new Map<string, Map<string, VisualizerResolvedParameter>>();
        for (const e of project.elements.filter(e => e.enabled)) {
            const values=new Map<string, VisualizerResolvedParameter>(); result.set(e.id,values);
            const descriptor=elementRegistry.get(e.type);
            for (const binding of e.bindings) {
                const parameter=descriptor.parameters.find(p => p.id === binding.parameterId)!;
                const parameterId=binding.parameterId;
                try {
                    if (binding.source.kind === 'unbound') { values.set(parameterId,{parameterId,state:'error',message:'输入未配置'}); continue; }
                    if (binding.source.kind === 'constant') { values.set(parameterId,{parameterId,state:'ready',value:binding.source.value}); continue; }
                    const source=binding.source;
                    const series=getSeries(source.featureId);
                    if (!series || series.trackHash !== project.track.contentHash) { values.set(parameterId,{parameterId,state:'loading',message:'等待分析数据'}); continue; }
                    const sample=(at:number) => projectAnalysisSeries(series,source.component ?? 'default',source.projection,at,
                        source.featureId === 'buffer' ? getWaveform?.(at) : undefined);
                    const raw=sample(time);
                    let value: number | number[];
                    const transform=binding.transform;
                    if (!transform) value=Array.isArray(raw) ? analysisSignal(raw,source.featureId) : Math.max(parameter.range?.min ?? -Infinity,Math.min(parameter.range?.max ?? Infinity,raw));
                    else if (Array.isArray(raw)) value=raw.map(n => outputValue(normalizedTarget(n,transform),transform,parameter));
                    else {
                        const key=e.id+':'+parameterId+':'+JSON.stringify(binding);
                        let smoother=this.smoothers.get(key);
                        if (!smoother) {
                            smoother=new ScalarSmoothingResolver(at => { const n=sample(at); if (typeof n !== 'number') throw Error('平滑需要标量'); return n; },transform,parameter);
                            this.smoothers.set(key,smoother);
                        }
                        value=smoother.resolve(time);
                    }
                    values.set(parameterId,{parameterId,state:'ready',value});
                } catch (error) { values.set(parameterId,{parameterId,state:'error',message:(error as Error).message}); }
            }
        }
        return result;
    }
}
