import { validateEditorProjectV1 } from '../editor/projectCodec';
import type { EditorTrackIdentityV1 } from '../editor/types';
import { elementRegistry } from './elementRegistry';
import { planCompositionFeatures } from './compositionModel';
import { canonicalBinding, canonicalTrack, integer, finite, invalid, iso, keys, record, text, UUID_PATTERN, VisualizerProjectValidationError } from './projectValidation';
import type { ElementBinding, ElementTiming, EffectTargets, VisualizerElement, VisualizerProjectV3, CompositionDraft } from './compositionTypes';
import type { VisualizerTrackValidationContext } from './types';

const id = (input: unknown) => { const value=text(input,'id'); if (!UUID_PATTERN.test(value)) invalid('元素或工程 ID 无效。'); return value; };
function timing(input: unknown, transition: boolean, project: VisualizerProjectV3): ElementTiming {
    const value = record(input,'timing');
    if (transition) {
        if (value.kind === 'unbound') { keys(value,['kind']); return { kind:'unbound' }; }
        keys(value,['kind','laneId','eventId']);
        if (value.kind !== 'editor-range') return invalid('转场必须使用单个范围标记。');
        const laneId=text(value.laneId,'laneId'), eventId=text(value.eventId,'eventId');
        const lane=project.editorSnapshot?.project.lanes.find(l => l.id === laneId);
        if (lane?.eventKind !== 'range' || !lane.events.some(e => e.id === eventId)) return invalid('转场范围引用已失效。');
        return { kind:'editor-range', laneId, eventId };
    }
    keys(value,['kind','startSeconds','endSeconds']);
    if (value.kind !== 'manual') return invalid('普通元素必须使用独立时间范围。');
    const startSeconds=finite(value.startSeconds,'startSeconds'), endSeconds=finite(value.endSeconds,'endSeconds');
    if (startSeconds < 0 || endSeconds <= startSeconds || endSeconds > project.track.durationSeconds) return invalid('元素时间范围超出歌曲。');
    return { kind:'manual', startSeconds, endSeconds };
}
function element(input: unknown, project: VisualizerProjectV3): VisualizerElement {
    const v=record(input,'element');
    keys(v,['id','type','version','name','enabled','layer','timing','bindings'],['targets']);
    let descriptor;
    try { descriptor=elementRegistry.get(text(v.type,'type')); } catch { return invalid('元素类型未注册。'); }
    if (v.version !== 1 || typeof v.enabled !== 'boolean') return invalid('元素版本或启用状态无效。');
    const layer=integer(v.layer,'layer');
    if (!Number.isSafeInteger(layer)) return invalid('层级必须为安全整数。');
    if (!Array.isArray(v.bindings) || v.bindings.length !== descriptor.parameters.length) return invalid('元素参数不完整。');
    const bindings: ElementBinding[] = descriptor.parameters.map((p,i) => {
        const b=record((v.bindings as unknown[])[i],'binding');
        const source=record(b.source,'source');
        if (source.kind === 'unbound') {
            keys(b,['parameterId','source']); keys(source,['kind']);
            if (b.parameterId !== p.id || !p.allowedSourceKinds.includes('analysis')) return invalid('此参数不能处于未绑定状态。');
            return { parameterId:p.id, source:{kind:'unbound'} };
        }
        if (source.kind !== 'constant' && source.kind !== 'analysis') return invalid('只支持固定值或原曲 Analyzer。');
        return canonicalBinding(b,p,undefined,'binding') as ElementBinding;
    });
    let targets: EffectTargets | undefined;
    if (descriptor.kind === 'visual') { if (v.targets !== undefined) return invalid('视觉元素不能引用效果目标。'); }
    else {
        const target=record(v.targets,'targets');
        if (target.kind === 'composition') { keys(target,['kind']); targets={kind:'composition'}; }
        else {
            keys(target,['kind','ids']);
            if (target.kind !== 'elements' || !Array.isArray(target.ids)) return invalid('影响对象无效。');
            const ids=target.ids.map(id);
            if (new Set(ids).size !== ids.length) return invalid('影响对象不能重复。');
            targets={kind:'elements',ids};
        }
    }
    return { id:id(v.id), type:descriptor.id, version:1, name:text(v.name,'name'), enabled:v.enabled,
        layer, timing:timing(v.timing,descriptor.kind === 'transition',project), bindings, ...(targets ? {targets} : {}) };
}
export function validateComposition(input: unknown, context?: VisualizerTrackValidationContext): VisualizerProjectV3 {
    const v=record(input,'project');
    if (v.schemaVersion !== 3) throw new VisualizerProjectValidationError('unsupported-schema','旧版 Visualizer 工程不兼容，请使用 V3 元素工程。');
    keys(v,['format','schemaVersion','projectId','createdAt','updatedAt','track','output','seed','elements'],['editorSnapshot']);
    if (v.format !== 'audiosurf-visualizer') return invalid('工程格式无效。');
    const track=canonicalTrack(v.track,context);
    const o=record(v.output,'output'); keys(o,['aspectRatio','resolution','frameRate']);
    if (o.aspectRatio !== '16:9' || !['720p','1080p'].includes(String(o.resolution)) || (o.frameRate !== 30 && o.frameRate !== 60)) return invalid('输出预设无效。');
    const seed=integer(v.seed,'seed'); if (seed < 0 || seed > 0xffffffff) return invalid('Seed 超出范围。');
    const createdAt=iso(v.createdAt,'createdAt'), updatedAt=iso(v.updatedAt,'updatedAt');
    if (Date.parse(updatedAt) < Date.parse(createdAt)) return invalid('更新时间早于创建时间。');
    const project: VisualizerProjectV3 = { format:'audiosurf-visualizer', schemaVersion:3, projectId:id(v.projectId), createdAt, updatedAt,
        track, output:{aspectRatio:'16:9',resolution:o.resolution as '720p'|'1080p',frameRate:o.frameRate}, seed, elements:[] };
    if (v.editorSnapshot !== undefined) {
        const s=record(v.editorSnapshot,'editorSnapshot'); keys(s,['capturedAt','project']);
        const editor=validateEditorProjectV1(s.project,{contentHash:track.contentHash,durationSeconds:track.durationSeconds,sampleRate:track.sampleRate ?? context?.sampleRate ?? 48000});
        project.editorSnapshot={capturedAt:iso(s.capturedAt,'capturedAt'),project:editor};
    }
    if (!Array.isArray(v.elements)) return invalid('elements 必须为列表。');
    project.elements=v.elements.map(e => element(e,project));
    const ids=new Set(project.elements.map(e => e.id));
    if (ids.size !== project.elements.length) return invalid('元素 ID 重复。');
    for (const e of project.elements) if (e.targets?.kind === 'elements') for (const targetId of e.targets.ids) {
        const target=project.elements.find(e => e.id === targetId);
        if (!target || elementRegistry.get(target.type).kind !== 'visual') return invalid('效果只能引用存在的视觉元素。');
    }
    try { planCompositionFeatures(project,true); } catch (error) { throw new VisualizerProjectValidationError('analysis-feature-limit',(error as Error).message); }
    return project;
}
export const createComposition = (track: EditorTrackIdentityV1): VisualizerProjectV3 => {
    const now=new Date().toISOString();
    return validateComposition({format:'audiosurf-visualizer',schemaVersion:3,projectId:crypto.randomUUID(),createdAt:now,updatedAt:now,
        track,output:{aspectRatio:'16:9',resolution:'720p',frameRate:30},seed:crypto.getRandomValues(new Uint32Array(1))[0],elements:[]});
};
export const encodeComposition = (project: VisualizerProjectV3) => new TextEncoder().encode(JSON.stringify(validateComposition(project),null,2)+'\n');
export const decodeComposition = (bytes: ArrayBuffer, context?: VisualizerTrackValidationContext) => {
    let value: unknown;
    try { value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
    catch { throw new VisualizerProjectValidationError('parse-failed','工程 JSON 无效。'); }
    return validateComposition(value,context);
};
export function validateCompositionDraft(input: unknown): CompositionDraft {
    const v=record(input,'draft'); keys(v,['schemaVersion','savedAt','project']);
    if (v.schemaVersion !== 3) return invalid('草稿版本不兼容。');
    return {schemaVersion:3,savedAt:iso(v.savedAt,'savedAt'),project:validateComposition(v.project)};
}
export const compositionFileFormat = { id:'json', extension:'.audiosurf-visualizer.json', mimeType:'application/json' } as const;
