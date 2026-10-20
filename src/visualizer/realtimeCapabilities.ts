import { isSupportedFeatureId } from '../analysis/types';
import { effectiveElements, elementAlgorithm, elementDescriptor } from './compositionModel';
import type { VisualizerProjectV5, VisualizerElement } from './compositionTypes';
import type { ResourceSnapshot, PresetDefinition } from './resourceTypes';
import { elementRegistry, findResource } from './elementRegistry';

export interface RealtimeCapabilities {
    browser: boolean;
    wallpaper: boolean;
    browserIssues: string[];
    wallpaperIssues: string[];
}
function inspect(elements: VisualizerElement[], resources: ResourceSnapshot, duration: number): RealtimeCapabilities {
    const browserIssues: string[] = [],
        wallpaperIssues: string[] = [];
    const model = { resources };
    if (!elements.some(e => elementDescriptor(model, e).kind === 'visual'))
        browserIssues.push('画面没有启用的视觉元素。');
    for (const e of elements) {
        const algorithm = elementAlgorithm(model, e),
            label = e.name + '：';
        if (algorithm.contract.historyParameters.length) browserIssues.push(label + '需要历史输入，暂不支持实时模式。');
        if (
            algorithm.contract.markerInputs?.length ||
            algorithm.contract.timingInput ||
            e.timing.kind === 'editor-range'
        )
            browserIssues.push(label + '依赖 Editor 标记。');
        if (algorithm.contract.kind === 'transition') browserIssues.push(label + '依赖转场时段。');
        if (
            e.timing.kind !== 'manual' ||
            Math.abs(e.timing.startSeconds) > 1e-6 ||
            Math.abs(e.timing.endSeconds - duration) > 1e-6
        )
            browserIssues.push(label + '需要覆盖完整歌曲，局部分镜不能转为常驻。');
        for (const b of e.bindings) {
            if (b.source.kind === 'unbound') browserIssues.push(label + '输入未配置。');
            if (b.source.kind === 'analysis' && !isSupportedFeatureId(b.source.featureId))
                browserIssues.push(label + '特征不支持实时分析。');
            if (
                b.source.kind === 'native' ||
                (b.source.kind === 'analysis' && b.source.featureId !== 'wallpaperEngineSpectrum')
            )
                wallpaperIssues.push(label + b.parameterId + ' 需要改用 Wallpaper Engine 频谱或固定值。');
        }
    }
    return {
        browser: !browserIssues.length,
        wallpaper: !browserIssues.length && !wallpaperIssues.length,
        browserIssues: [...new Set(browserIssues)],
        wallpaperIssues: [...new Set([...browserIssues, ...wallpaperIssues])],
    };
}
export function inspectRealtimeProject(project: VisualizerProjectV5): RealtimeCapabilities {
    return inspect(
        effectiveElements(project).filter(e => e.enabled),
        project.resources,
        project.track.durationSeconds,
    );
}
export function inspectRealtimePreset(preset: PresetDefinition): RealtimeCapabilities {
    const elements = preset.elements
        .filter(e => e.enabled)
        .map((e, layer) => ({
            ...e,
            id: e.key,
            resource: e.element,
            layer,
            timing:
                e.timing.kind === 'relative'
                    ? { kind: 'manual' as const, startSeconds: e.timing.start, endSeconds: e.timing.end }
                    : { kind: 'unbound' as const },
        }));
    const definitions = elements.map(e => elementRegistry.get(e.resource));
    return inspect(
        elements,
        {
            elements: definitions,
            algorithms: definitions.map(d => findResource(elementRegistry.algorithms, d.algorithm)),
            presets: [],
        },
        1,
    );
}
