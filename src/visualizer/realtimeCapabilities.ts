import { isSupportedFeatureId } from '../analysis/types';
import { effectiveElements, elementAlgorithm, elementDescriptor } from './compositionModel';
import type { VisualizerProjectV6, VisualizerElement } from './compositionTypes';
import type { ResourceSnapshot, PresetDefinition } from './resourceTypes';
import { elementRegistry, findResource } from './elementRegistry';

export interface RealtimeCapabilities {
    browser: boolean;
    wallpaper: boolean;
    browserIssues: string[];
    wallpaperIssues: string[];
}
export function inspectRealtimeContent(
    elements: VisualizerElement[],
    resources: ResourceSnapshot,
    duration: number,
): RealtimeCapabilities {
    const browserIssues: string[] = [],
        wallpaperIssues: string[] = [];
    const model = { resources };
    if (!elements.some(e => elementDescriptor(model, e).kind === 'visual'))
        browserIssues.push('画面没有启用的视觉元素。');
    for (const e of elements) {
        const algorithm = elementAlgorithm(model, e),
            label = e.name + '：';
        if (algorithm.apiVersion >= 3 && !algorithm.contract.executionModes?.includes('realtime'))
            browserIssues.push(label + '不支持实时执行。');
        if (
            algorithm.contract.historyParameters.length &&
            !(algorithm.apiVersion >= 3 && algorithm.contract.executionModes?.includes('realtime'))
        )
            browserIssues.push(label + '需要历史输入，暂不支持实时模式。');
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
            if (b.source.kind === 'analysis' && b.source.stemRole)
                browserIssues.push(label + '分轨来源仅用于歌曲工程。');
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
export function inspectRealtimeProject(project: VisualizerProjectV6): RealtimeCapabilities {
    const active = effectiveElements(project).filter(e => e.enabled);
    const result = inspectRealtimeContent(active, project.resources, project.track.durationSeconds);
    const scenes = project.items.flatMap(i =>
        i.kind === 'scene3d' ? [i] : i.kind === 'preset' ? (i.scenes3d ?? []) : [],
    );
    if (
        scenes.some(
            s =>
                s.enabled &&
                s.children.some(id => active.some(e => e.id === id)) &&
                (s.startSeconds !== 0 || s.endSeconds !== project.track.durationSeconds),
        )
    ) {
        result.browser = result.wallpaper = false;
        result.browserIssues.push('三维场景需要覆盖完整歌曲。');
        result.wallpaperIssues.push('三维场景需要覆盖完整歌曲。');
    }
    return result;
}
export function inspectRealtimePreset(preset: PresetDefinition): RealtimeCapabilities {
    const disabled = new Set(preset.scenes3d?.filter(s => !s.enabled).flatMap(s => s.children));
    const elements = preset.elements
        .filter(e => e.enabled && !disabled.has(e.key))
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
    const result = inspectRealtimeContent(
        elements,
        {
            elements: definitions,
            algorithms: definitions.map(d => findResource(elementRegistry.algorithms, d.algorithm)),
            presets: [],
        },
        1,
    );
    if (
        preset.scenes3d?.some(
            s =>
                s.enabled &&
                s.children.some(key => elements.some(e => e.key === key)) &&
                (s.start !== 0 || s.end !== 1),
        )
    ) {
        result.browser = result.wallpaper = false;
        result.browserIssues.push('三维场景需要覆盖完整歌曲。');
        result.wallpaperIssues.push('三维场景需要覆盖完整歌曲。');
    }
    return result;
}
