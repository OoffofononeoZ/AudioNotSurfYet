import { validateMediaAssets, validateMediaBindings } from './mediaCodec';
import { readEditorProject } from '../editor/projectCodec';
import type { EditorTrackIdentityV1 } from '../editor/types';
import { elementDescriptor } from './compositionModel';
import { validateElementBindings } from './elementBindings';
import { validateMarkerBindings } from './editorMarkerValidation';
import { validateResourceRef, validateResourceSnapshot } from './resourceCodec';
import { sameResource } from './resourceIdentity';
import { validateCompositionItems } from './compositionStructure';
import { planCompositionFeatures } from './compositionModel';
import {
    canonicalTrack,
    integer,
    finite,
    invalid,
    iso,
    keys,
    record,
    text,
    UUID_PATTERN,
    VisualizerProjectValidationError,
} from './projectValidation';
import { elementSeedField } from './seed';
import { migrateLegacySeeds } from './seedMigration';
import type {
    ElementTiming,
    EffectTargets,
    VisualizerElement,
    VisualizerProjectV5,
    CompositionDraft,
} from './compositionTypes';
import type { VisualizerTrackValidationContext } from './types';

const id = (input: unknown) => {
    const value = text(input, 'id');
    if (!UUID_PATTERN.test(value)) invalid('元素或工程 ID 无效。');
    return value;
};
function timing(input: unknown, transition: boolean, project: VisualizerProjectV5): ElementTiming {
    const value = record(input, 'timing');
    if (transition) {
        if (value.kind === 'unbound') {
            keys(value, ['kind']);
            return { kind: 'unbound' };
        }
        keys(value, ['kind', 'laneId', 'eventId']);
        if (value.kind !== 'editor-range') return invalid('转场必须使用单个范围标记。');
        const laneId = text(value.laneId, 'laneId'),
            eventId = text(value.eventId, 'eventId');
        const lane = project.editorSnapshot?.project.lanes.find(l => l.id === laneId);
        if (lane?.eventKind !== 'range' || !lane.events.some(e => e.id === eventId))
            return invalid('转场范围引用已失效。');
        return { kind: 'editor-range', laneId, eventId };
    }
    keys(value, ['kind', 'startSeconds', 'endSeconds']);
    if (value.kind !== 'manual') return invalid('普通元素必须使用独立时间范围。');
    const startSeconds = finite(value.startSeconds, 'startSeconds'),
        endSeconds = finite(value.endSeconds, 'endSeconds');
    if (startSeconds < 0 || endSeconds <= startSeconds || endSeconds > project.track.durationSeconds)
        return invalid('元素时间范围超出歌曲。');
    return { kind: 'manual', startSeconds, endSeconds };
}
function element(input: unknown, project: VisualizerProjectV5): VisualizerElement {
    const v = record(input, 'element');
    keys(
        v,
        ['id', 'resource', 'name', 'enabled', 'layer', 'timing', 'bindings'],
        ['targets', 'markerBindings', 'seed', 'mediaBindings'],
    );
    const resource = validateResourceRef(v.resource);
    const descriptor = project.resources.elements.find(d => sameResource(d, resource));
    if (!descriptor) return invalid('元素定义缺失。');
    if (typeof v.enabled !== 'boolean') return invalid('元素版本或启用状态无效。');
    const layer = integer(v.layer, 'layer');
    if (!Number.isSafeInteger(layer)) return invalid('层级必须为安全整数。');
    const bindings = validateElementBindings(v.bindings, descriptor.parameters);
    const mediaBindings = validateMediaBindings(v.mediaBindings, descriptor.mediaInputs, project.mediaAssets);
    const algorithm = project.resources.algorithms.find(a => sameResource(a, descriptor.algorithm))!;
    const markerBindings = validateMarkerBindings(
        v.markerBindings,
        descriptor.markerInputs,
        algorithm.contract.timingInput,
        project.editorSnapshot?.project,
    );
    let targets: EffectTargets | undefined;
    if (descriptor.kind === 'visual') {
        if (v.targets !== undefined) return invalid('视觉元素不能引用效果目标。');
    } else {
        const target = record(v.targets, 'targets');
        if (target.kind === 'composition') {
            keys(target, ['kind']);
            targets = { kind: 'composition' };
        } else {
            keys(target, ['kind', 'ids']);
            if (target.kind !== 'elements' || !Array.isArray(target.ids)) return invalid('影响对象无效。');
            const ids = target.ids.map(id);
            if (new Set(ids).size !== ids.length) return invalid('影响对象不能重复。');
            targets = { kind: 'elements', ids };
        }
    }
    return {
        id: id(v.id),
        resource,
        name: text(v.name, 'name'),
        enabled: v.enabled,
        ...elementSeedField(v.seed, descriptor.usesSeed),
        layer,
        timing: timing(v.timing, descriptor.kind === 'transition', project),
        bindings,
        ...(markerBindings ? { markerBindings } : {}),
        ...(mediaBindings ? { mediaBindings } : {}),
        ...(targets ? { targets } : {}),
    };
}
export function validateComposition(input: unknown, context?: VisualizerTrackValidationContext): VisualizerProjectV5 {
    const v = record(migrateLegacySeeds(input), 'project');
    if (v.schemaVersion !== 5)
        throw new VisualizerProjectValidationError(
            'unsupported-schema',
            '旧版 Visualizer 工程不兼容，请使用 V5 资源工程。',
        );
    keys(
        v,
        [
            'format',
            'schemaVersion',
            'projectId',
            'createdAt',
            'updatedAt',
            'track',
            'output',
            'elements',
            'items',
            'resources',
        ],
        ['editorSnapshot', 'mediaAssets'],
    );
    if (v.format !== 'audiosurf-visualizer') return invalid('工程格式无效。');
    const track = canonicalTrack(v.track, context);
    const o = record(v.output, 'output');
    keys(o, ['aspectRatio', 'resolution', 'frameRate']);
    if (
        o.aspectRatio !== '16:9' ||
        !['720p', '1080p'].includes(String(o.resolution)) ||
        (o.frameRate !== 30 && o.frameRate !== 60)
    )
        return invalid('输出预设无效。');
    const createdAt = iso(v.createdAt, 'createdAt'),
        updatedAt = iso(v.updatedAt, 'updatedAt');
    if (Date.parse(updatedAt) < Date.parse(createdAt)) return invalid('更新时间早于创建时间。');
    const project: VisualizerProjectV5 = {
        format: 'audiosurf-visualizer',
        schemaVersion: 5,
        projectId: id(v.projectId),
        createdAt,
        updatedAt,
        track,
        output: { aspectRatio: '16:9', resolution: o.resolution as '720p' | '1080p', frameRate: o.frameRate },
        elements: [],
        items: [],
        resources: validateResourceSnapshot(v.resources),
        ...(v.mediaAssets === undefined ? {} : { mediaAssets: validateMediaAssets(v.mediaAssets) }),
    };
    if (v.editorSnapshot !== undefined) {
        const s = record(v.editorSnapshot, 'editorSnapshot');
        keys(s, ['capturedAt', 'project']);
        const editor = readEditorProject(s.project, {
            contentHash: track.contentHash,
            durationSeconds: track.durationSeconds,
            sampleRate: track.sampleRate ?? context?.sampleRate ?? 48000,
        });
        project.editorSnapshot = { capturedAt: iso(s.capturedAt, 'capturedAt'), project: editor };
    }
    if (!Array.isArray(v.elements)) return invalid('elements 必须为列表。');
    project.elements = v.elements.map(e => element(e, project));
    project.items = validateCompositionItems(v.items, project);
    const ids = new Set(project.elements.map(e => e.id));
    if (ids.size !== project.elements.length) return invalid('元素 ID 重复。');
    for (const e of project.elements)
        if (e.targets?.kind === 'elements')
            for (const targetId of e.targets.ids) {
                const target = project.elements.find(e => e.id === targetId);
                if (!target || elementDescriptor(project, target).kind !== 'visual')
                    return invalid('效果只能引用存在的视觉元素。');
            }
    try {
        planCompositionFeatures(project, true);
    } catch (error) {
        throw new VisualizerProjectValidationError('analysis-feature-limit', (error as Error).message);
    }
    return project;
}
export const createComposition = (track: EditorTrackIdentityV1): VisualizerProjectV5 => {
    const now = new Date().toISOString();
    return validateComposition({
        format: 'audiosurf-visualizer',
        schemaVersion: 5,
        projectId: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        track,
        output: { aspectRatio: '16:9', resolution: '720p', frameRate: 30 },
        elements: [],
        items: [],
        resources: { algorithms: [], elements: [], presets: [] },
    });
};
export const encodeComposition = (project: VisualizerProjectV5) =>
    new TextEncoder().encode(JSON.stringify(validateComposition(project), null, 2) + '\n');
export const decodeComposition = (bytes: ArrayBuffer, context?: VisualizerTrackValidationContext) => {
    let value: unknown;
    try {
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
        throw new VisualizerProjectValidationError('parse-failed', '工程 JSON 无效。');
    }
    return validateComposition(value, context);
};
export function validateCompositionDraft(input: unknown): CompositionDraft {
    const v = record(input, 'draft');
    keys(v, ['schemaVersion', 'savedAt', 'project']);
    if (v.schemaVersion !== 5) return invalid('草稿版本不兼容。');
    return { schemaVersion: 5, savedAt: iso(v.savedAt, 'savedAt'), project: validateComposition(v.project) };
}
export const compositionFileFormat = {
    id: 'json',
    extension: '.audiosurf-visualizer.json',
    mimeType: 'application/json',
} as const;
