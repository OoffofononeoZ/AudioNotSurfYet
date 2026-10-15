import { validateEditorProjectV1 } from '../editor/projectCodec';
import { SceneRegistry, type SceneTemplateDescriptor } from './sceneRegistry';
import type { VisualizerProjectV1, VisualizerTemplateId, VisualizerTrackValidationContext } from './types';
import type { EditorTrackIdentityV1 } from '../editor/types';
import { canonicalBinding, canonicalTrack, integer, invalid, iso, keys, record, text, UUID_PATTERN, VisualizerProjectValidationError } from './projectValidation';
export { VisualizerProjectValidationError } from './projectValidation';
export type { VisualizerProjectValidationCode } from './projectValidation';
export const validateVisualizerProjectV1 = (
    input: unknown,
    context?: VisualizerTrackValidationContext,
    registry = new SceneRegistry(),
): VisualizerProjectV1 => {
    const value = record(input, 'project');
    if (value.format !== 'audiosurf-visualizer' || value.schemaVersion !== 1) {
        if (value.schemaVersion !== 1) {
            throw new VisualizerProjectValidationError(
                'unsupported-schema',
                `Unsupported Visualizer schema: ${String(value.schemaVersion)}.`,
            );
        }
        invalid('Visualizer project format is invalid.');
    }
    keys(value, [
        'format', 'schemaVersion', 'projectId', 'createdAt', 'updatedAt',
        'track', 'output', 'scene',
    ], ['editorSnapshot'], 'project');
    const projectId = text(value.projectId, 'project.projectId');
    if (!UUID_PATTERN.test(projectId)) invalid('project.projectId must be a UUID.');
    const createdAt = iso(value.createdAt, 'project.createdAt');
    const updatedAt = iso(value.updatedAt, 'project.updatedAt');
    if (Date.parse(updatedAt) < Date.parse(createdAt)) invalid('project.updatedAt precedes createdAt.');
    const track = canonicalTrack(value.track, context);
    const output = record(value.output, 'project.output');
    keys(output, ['aspectRatio', 'resolution', 'frameRate'], [], 'project.output');
    if (output.aspectRatio !== '16:9') invalid('project.output.aspectRatio must be 16:9.');
    if (output.resolution !== '720p' && output.resolution !== '1080p') {
        invalid('project.output.resolution is invalid.');
    }
    if (output.frameRate !== 30 && output.frameRate !== 60) {
        invalid('project.output.frameRate is invalid.');
    }

    let editorSnapshot: VisualizerProjectV1['editorSnapshot'];
    if (value.editorSnapshot !== undefined) {
        const snapshot = record(value.editorSnapshot, 'project.editorSnapshot');
        keys(snapshot, ['capturedAt', 'project'], [], 'project.editorSnapshot');
        const editorProject = validateEditorProjectV1(snapshot.project, {
            contentHash: track.contentHash,
            durationSeconds: track.durationSeconds,
            sampleRate: track.sampleRate ?? context?.sampleRate ?? 48_000,
        });
        editorSnapshot = {
            capturedAt: iso(snapshot.capturedAt, 'project.editorSnapshot.capturedAt'),
            project: editorProject,
        };
    }

    const scene = record(value.scene, 'project.scene');
    keys(scene, ['templateId', 'templateVersion', 'seed', 'bindings'], [], 'project.scene');
    if (scene.templateId !== 'orthogonal-lines' && scene.templateId !== 'cube-swarm') {
        invalid('project.scene.templateId is invalid.');
    }
    if (scene.templateVersion !== 1) invalid('project.scene.templateVersion is invalid.');
    const templateId = scene.templateId as VisualizerTemplateId;
    const descriptor: SceneTemplateDescriptor = (() => {
        try {
            return registry.get(templateId, 1);
        } catch (error) {
            return invalid(
                error instanceof Error
                    ? error.message
                    : 'Unknown Visualizer template.',
            );
        }
    })();
    const seed = integer(scene.seed, 'project.scene.seed');
    if (seed < 0 || seed > 0xffff_ffff) invalid('project.scene.seed is outside uint32.');
    if (!Array.isArray(scene.bindings) || scene.bindings.length !== descriptor.parameters.length) {
        invalid('project.scene.bindings must contain every template parameter exactly once.');
    }
    const rawBindings = scene.bindings as unknown[];
    for (let index = 0; index < rawBindings.length; index += 1) {
        if (!(index in rawBindings)) invalid('project.scene.bindings must not be sparse.');
    }
    const seen = new Set<string>();
    const bindings = descriptor.parameters.map((parameter, index) => {
        const raw = record(rawBindings[index], `project.scene.bindings[${index}]`);
        const parameterId = typeof raw.parameterId === 'string' ? raw.parameterId : '';
        if (seen.has(parameterId)) invalid('project.scene.bindings contains a duplicate parameter.');
        seen.add(parameterId);
        return canonicalBinding(
            raw,
            parameter,
            editorSnapshot?.project,
            `project.scene.bindings[${index}]`,
        );
    });
    const activeFeatures = new Set(
        bindings.flatMap((binding) => binding.source.kind === 'analysis'
            ? [binding.source.featureId]
            : []),
    );
    if (activeFeatures.size > 4) {
        throw new VisualizerProjectValidationError(
            'analysis-feature-limit',
            'Visualizer projects may use at most four unique analysis features.',
        );
    }
    return {
        format: 'audiosurf-visualizer',
        schemaVersion: 1,
        projectId,
        createdAt,
        updatedAt,
        track,
        output: {
            aspectRatio: '16:9',
            resolution: output.resolution as '720p' | '1080p',
            frameRate: output.frameRate as 30 | 60,
        },
        scene: { templateId, templateVersion: 1, seed, bindings },
        ...(editorSnapshot ? { editorSnapshot } : {}),
    };
};

export const createInitialVisualizerProject = (input: {
    track: EditorTrackIdentityV1;
    registry?: SceneRegistry;
    createId?: () => string;
    createSeed?: () => number;
    now?: () => Date;
}): VisualizerProjectV1 => {
    const registry = input.registry ?? new SceneRegistry();
    const now = input.now ?? (() => new Date());
    const timestamp = now().toISOString();
    const createSeed = input.createSeed ?? (() => crypto.getRandomValues(new Uint32Array(1))[0]!);
    return validateVisualizerProjectV1({
        format: 'audiosurf-visualizer',
        schemaVersion: 1,
        projectId: (input.createId ?? (() => crypto.randomUUID()))(),
        createdAt: timestamp,
        updatedAt: timestamp,
        track: input.track,
        output: { aspectRatio: '16:9', resolution: '720p', frameRate: 30 },
        scene: {
            templateId: 'orthogonal-lines',
            templateVersion: 1,
            seed: createSeed(),
            bindings: registry.createConstantBindings('orthogonal-lines'),
        },
    }, undefined, registry);
};

export const encodeVisualizerProjectV1 = (
    project: VisualizerProjectV1,
    registry?: SceneRegistry,
): Uint8Array => new TextEncoder().encode(
    `${JSON.stringify(validateVisualizerProjectV1(project, undefined, registry), null, 2)}\n`,
);

export const decodeVisualizerProjectV1 = (
    input: ArrayBuffer | Uint8Array | string,
    context?: VisualizerTrackValidationContext,
    registry?: SceneRegistry,
): VisualizerProjectV1 => {
    try {
        const source = typeof input === 'string'
            ? input
            : new TextDecoder('utf-8', { fatal: true }).decode(input);
        return validateVisualizerProjectV1(JSON.parse(source) as unknown, context, registry);
    } catch (error) {
        if (error instanceof VisualizerProjectValidationError) throw error;
        throw new VisualizerProjectValidationError(
            'parse-failed',
            error instanceof Error ? error.message : 'Visualizer JSON parse failed.',
        );
    }
};

export interface VisualizerFormatCodec {
    id: 'json-v1';
    label: 'JSON';
    extension: '.audiosurf-visualizer.json';
    mimeType: 'application/json';
    encode(project: VisualizerProjectV1, registry?: SceneRegistry): Uint8Array;
    decode(
        input: ArrayBuffer | Uint8Array | string,
        context?: VisualizerTrackValidationContext,
        registry?: SceneRegistry,
    ): VisualizerProjectV1;
}

export const VISUALIZER_JSON_V1_CODEC: VisualizerFormatCodec = {
    id: 'json-v1',
    label: 'JSON',
    extension: '.audiosurf-visualizer.json',
    mimeType: 'application/json',
    encode: encodeVisualizerProjectV1,
    decode: decodeVisualizerProjectV1,
};

export class VisualizerFormatCodecRegistry {
    private readonly codecs = new Map<string, VisualizerFormatCodec>();

    constructor(codecs: readonly VisualizerFormatCodec[] = [VISUALIZER_JSON_V1_CODEC]) {
        for (const codec of codecs) {
            if (this.codecs.has(codec.id)) throw new Error(`Duplicate Visualizer codec: ${codec.id}`);
            this.codecs.set(codec.id, codec);
        }
    }

    list(): readonly VisualizerFormatCodec[] {
        return [...this.codecs.values()];
    }

    get(id: string): VisualizerFormatCodec {
        const codec = this.codecs.get(id);
        if (!codec) throw new Error(`Unknown Visualizer codec: ${id}`);
        return codec;
    }
}

export const visualizerProjectFileName = (
    fileName: string,
    codec: VisualizerFormatCodec,
): string => {
    const base = fileName.replace(/\.[^.]+$/, '').trim() || 'visualizer-project';
    return `${base}${codec.extension}`;
};
