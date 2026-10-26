import * as THREE from 'three';
import { sceneGroups, elementScene, renderUnits, findScene3d } from './scene3dModel';
import { resolveSceneCamera } from './scene3dCamera';
import { defaultTransform3d } from './scene3dTypes';
import type { CameraFrame } from './scene3dTypes';
import { CompositionMediaHost } from './mediaHost';
import { quadVertex, compositeFragment } from './compositionShaders';
import { elementRange, effectiveElements, elementDescriptor } from './compositionModel';
import { effectsFor, parameterKey } from './compositionEffects';
import { findResource } from './elementRegistry';
import { AlgorithmDrawRenderer } from './algorithmDrawRenderer';
import { IsolatedAlgorithmRuntime } from './isolatedAlgorithmRuntime';
import { createEditorMarkerReader } from './editorMarkerReader';
import { AlgorithmFrameRevisions, stateParameterIds } from './algorithmFrameRevision';
import { FrameSupersededError } from './framePreparation';
import type { MarkerReader } from './editorMarkerTypes';
import type { DrawPacket, AlgorithmFrame, HistorySample } from './algorithmTypes';
import type { VisualizerElement, CompositionRenderModel } from './compositionTypes';
import type { VisualizerScene, VisualizerSceneRenderInput, VisualizerResolvedParameterMap } from './rendererTypes';
export type CompositionRenderPort = Pick<
    import('./rendererTypes').VisualizerRenderer,
    'render' | 'setRenderTarget' | 'clear' | 'setClearColor' | 'autoClear'
>;
export type AlgorithmRuntimePort = Pick<IsolatedAlgorithmRuntime, 'initialize' | 'prepareFrames' | 'dispose'>;
export interface CompositionSceneOptions {
    renderer: CompositionRenderPort;
    readProject(): CompositionRenderModel | null;
    realtime?: boolean;
    resolveAt(time: number): VisualizerResolvedParameterMap;
    prepareAt?(time: number): Promise<void>;
    readInputIdentity?(element: VisualizerElement, parameterIds: readonly string[]): string;
    runtimeFactory?(): AlgorithmRuntimePort;
}
const hashText = (text: string) => {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
};
/** Host composition is algorithm-agnostic: three targets, one renderer, no algorithm code on the page. */
export class CompositionScene implements VisualizerScene {
    readonly kind = 'rendered' as const;
    private options: CompositionSceneOptions;
    private scene = new THREE.Scene();
    private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private geometry = new THREE.PlaneGeometry(2, 2);
    private material = new THREE.ShaderMaterial({
        vertexShader: quadVertex,
        fragmentShader: compositeFragment,
        depthTest: false,
        depthWrite: false,
        premultipliedAlpha: true,
        toneMapped: false,
        uniforms: { uImage: { value: null }, uFinal: { value: false } },
    });
    private quad = new THREE.Mesh(this.geometry, this.material);
    private targets = [
        new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }),
        new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }),
    ];
    private accumulation = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    private worldTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
    private cameras = new Map<string, CameraFrame>();
    private gpu = new AlgorithmDrawRenderer(this.geometry);
    private media = new CompositionMediaHost();
    private runtime: AlgorithmRuntimePort | null = null;
    private runtimeSignature = '';
    private initialization: Promise<void> | null = null;
    private markerProject: CompositionRenderModel | null = null;
    private markers: MarkerReader | undefined;
    private packets = new Map<string, DrawPacket>();
    private prepared: CompositionRenderModel | null = null;
    private needsSourcePrompt = false;
    private width = 1;
    private height = 1;
    private disposed = false;
    private revisions = new AlgorithmFrameRevisions();
    constructor(options: CompositionSceneOptions) {
        this.options = options;
        this.quad.frustumCulled = false;
        this.scene.add(this.quad);
    }
    async prepare(input: VisualizerSceneRenderInput) {
        if (this.disposed) throw Error('元素合成器已释放。');
        const project = this.options.readProject();
        const sources: Array<{ element: VisualizerElement; ids: string[]; identity: string }> = [];
        const assertCurrent = () => {
            if (this.disposed || this.options.readProject() !== project || input.isCurrent?.() === false)
                throw new FrameSupersededError();
            if (
                sources.some(source => this.options.readInputIdentity?.(source.element, source.ids) !== source.identity)
            )
                throw new FrameSupersededError();
        };
        await this.options.prepareAt?.(input.timeSeconds);
        assertCurrent();
        const values = this.options.prepareAt ? this.options.resolveAt(input.timeSeconds) : input.values;
        this.packets.clear();
        this.cameras.clear();
        this.needsSourcePrompt = false;
        if (!project || !project.elements.length) {
            this.media.dispose();
            this.media = new CompositionMediaHost();
            this.runtime?.dispose();
            this.runtime = null;
            this.runtimeSignature = '';
            this.markerProject = null;
            this.markers = undefined;
            this.initialization = null;
            this.prepared = project;
            return;
        }
        // Parameter values travel inside every prepared frame, so only structural changes may rebuild the sandbox.
        const signature =
            project.projectId +
            ':' +
            [...input.elementSeeds]
                .map(([id, seed]) => id + ':' + seed)
                .sort()
                .join('|') +
            ':' +
            project.elements.map(e => e.id + ':' + elementDescriptor(project, e).algorithm.hash).join('|');
        if (signature !== this.runtimeSignature) {
            this.runtime?.dispose();
            this.runtimeSignature = signature;
            this.runtime = this.options.runtimeFactory?.() ?? new IsolatedAlgorithmRuntime();
            this.initialization = this.runtime.initialize(
                project.elements.map(e => ({
                    id: e.id,
                    algorithm: findResource(project.resources.algorithms, elementDescriptor(project, e).algorithm),
                })),
            );
        }
        // A marker index belongs to one immutable project revision; rebuild only that index when the revision changes.
        if (this.markerProject !== project) {
            const reader = createEditorMarkerReader(
                project,
                () => !this.disposed && this.markers === reader && this.options.readProject() === project,
            );
            this.markerProject = project;
            this.markers = reader;
        }
        const runtime = this.runtime!;
        await this.initialization;
        assertCurrent();
        if (runtime !== this.runtime) throw new FrameSupersededError();
        this.revisions.retain(project.elements.map(e => e.id));
        const used = new Set<string>();
        for (const e of effectiveElements(project)) {
            const range = elementRange(project, e);
            if (
                !e.enabled ||
                elementDescriptor(project, e).kind !== 'visual' ||
                !range ||
                input.timeSeconds < range.startSeconds ||
                input.timeSeconds > range.endSeconds
            )
                continue;
            used.add(e.id);
            for (const effect of effectsFor(project, e.id, input.timeSeconds)) used.add(effect.id);
            const scene = elementScene(project, e.id);
            if (scene) for (const effect of effectsFor(project, scene.id, input.timeSeconds, true)) used.add(effect.id);
        }
        for (const e of effectsFor(project, null, input.timeSeconds)) used.add(e.id);
        for (const e of effectiveElements(project).filter(e => used.has(e.id))) {
            const a = findResource(project.resources.algorithms, elementDescriptor(project, e).algorithm);
            if (
                a.apiVersion >= 3 &&
                !a.contract.executionModes?.includes(this.options.realtime ? 'realtime' : 'timeline')
            )
                throw Error('元素不支持当前执行模式。');
        }
        const mediaFrames = await this.media.prepare(
            project,
            effectiveElements(project).filter(e => used.has(e.id)),
            input.timeSeconds,
            !!this.options.realtime,
            input.animate === false,
        );
        assertCurrent();
        if (runtime !== this.runtime) throw new FrameSupersededError();
        for (const scene of sceneGroups(project).filter(s => s.enabled && s.children.some(id => used.has(id))))
            this.cameras.set(
                scene.id,
                resolveSceneCamera(scene.camera, input.timeSeconds - scene.startSeconds, this.width, this.height),
            );
        const frames = effectiveElements(project)
            .filter(e => used.has(e.id))
            .flatMap(e => {
                if (Object.values(e.markerBindings ?? {}).some(b => b.kind === 'unbound')) {
                    this.needsSourcePrompt = true;
                    return [];
                }
                const parameters: AlgorithmFrame['parameters'] = {};
                const seed = input.elementSeeds.get(e.id);
                if (elementDescriptor(project, e).usesSeed && seed === undefined)
                    throw Error('元素运行时 Seed 尚未初始化。');
                for (const binding of e.bindings) {
                    const value = values.get(parameterKey(e.id, binding.parameterId));
                    if (value?.state !== 'ready' || value.value === undefined) {
                        this.needsSourcePrompt = true;
                        return [];
                    }
                    parameters[binding.parameterId] = {
                        value: value.value,
                        ...(value.unit ? { unit: value.unit } : {}),
                    };
                }
                const ids = stateParameterIds(
                    findResource(project.resources.algorithms, elementDescriptor(project, e).algorithm).contract,
                );
                const identity = this.options.readInputIdentity?.(e, ids);
                if (identity !== undefined) sources.push({ element: e, ids, identity });
                return [
                    {
                        id: e.id,
                        frame: {
                            time: input.timeSeconds,
                            seed: seed ?? 0,
                            revision: this.revisions.resolve(
                                project,
                                e,
                                identity ?? (this.options.realtime ? String(input.bindingRevision) : ''),
                            ),
                            width: this.width,
                            height: this.height,
                            range: this.options.realtime ? null : elementRange(project, e),
                            parameters,
                            ...aWorldCamera(project, e, this.cameras),
                            ...(findResource(project.resources.algorithms, elementDescriptor(project, e).algorithm)
                                .apiVersion >= 3
                                ? {
                                      mode: this.options.realtime ? ('realtime' as const) : ('timeline' as const),
                                      media: mediaFrames.get(e.id),
                                  }
                                : {}),
                        },
                    },
                ];
            });
        const packets = await runtime.prepareFrames(
            frames,
            async (elementId, request) => {
                assertCurrent();
                if (this.options.realtime) throw Error('实时模式不允许历史输入查询。');
                const samples: HistorySample[] = [];
                for (let tick = request.startTick; tick < request.endTick; tick++) {
                    await this.options.prepareAt?.(tick / 60);
                    assertCurrent();
                    const value = this.options.resolveAt(tick / 60).get(parameterKey(elementId, request.parameterId));
                    if (value?.state !== 'ready' || value.value === undefined) throw Error('算法历史输入尚未就绪。');
                    samples.push({ time: tick / 60, value: value.value, ...(value.unit ? { unit: value.unit } : {}) });
                }
                return samples;
            },
            undefined,
            this.options.realtime
                ? undefined
                : async (elementId, query) => {
                      assertCurrent();
                      const page = await this.markers!(elementId, query);
                      assertCurrent();
                      return page;
                  },
        );
        assertCurrent();
        if (runtime !== this.runtime) throw new FrameSupersededError();
        this.packets = packets;
        this.prepared = project;
    }
    private clear(target: THREE.WebGLRenderTarget | null) {
        this.options.renderer.setRenderTarget(target);
        this.options.renderer.setClearColor('#000000', 0);
        this.options.renderer.clear(true, false, false);
    }
    private copy(
        source: THREE.WebGLRenderTarget,
        target: THREE.WebGLRenderTarget | null,
        blend = false,
        final = false,
    ) {
        this.material.uniforms.uImage!.value = source.texture;
        this.material.uniforms.uFinal!.value = final;
        this.material.transparent = blend;
        this.material.blending = blend ? THREE.NormalBlending : THREE.NoBlending;
        this.material.uniformsNeedUpdate = true;
        if (blend) this.options.renderer.setRenderTarget(target);
        else this.clear(target);
        this.options.renderer.render(this.scene, this.camera);
    }
    private drawElement(project: CompositionRenderModel, e: VisualizerElement, source?: THREE.WebGLRenderTarget) {
        let current = source;
        const algorithm = findResource(project.resources.algorithms, elementDescriptor(project, e).algorithm);
        for (const pass of this.packets.get(e.id)?.passes ?? []) {
            const target = current === this.targets[0] ? this.targets[1]! : this.targets[0]!;
            this.clear(target);
            this.gpu.draw(this.options.renderer, algorithm, pass, current?.texture, (inputId, slot) =>
                this.media.texture(e.id, inputId, slot),
            );
            current = target;
        }
        return current;
    }
    render(input: VisualizerSceneRenderInput) {
        if (this.disposed) throw Error('元素合成器已释放。');
        const project = this.options.readProject();
        if (!project) return { hash: 'empty', needsSourcePrompt: false };
        if (this.prepared !== project) throw Error('算法帧尚未准备完成。');
        const renderer = this.options.renderer,
            previousAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        const hashes = [
            input.timeSeconds.toFixed(6),
            ...[...input.elementSeeds].map(([id, seed]) => id + ':' + seed).sort(),
        ];
        try {
            this.clear(this.accumulation);
            const effective = effectiveElements(project);
            for (const unit of renderUnits(project)) {
                if (unit.kind === 'scene3d') {
                    const scene = findScene3d(project, unit.id)!;
                    const visible = effective.filter(
                        e => scene.children.includes(e.id) && e.enabled && this.packets.has(e.id),
                    );
                    if (
                        !visible.length ||
                        !scene.enabled ||
                        input.timeSeconds < scene.startSeconds ||
                        input.timeSeconds > scene.endSeconds
                    )
                        continue;
                    renderer.setRenderTarget(this.worldTarget);
                    renderer.setClearColor('#000000', 0);
                    renderer.clear(true, true, false);
                    for (const e of visible) {
                        const algorithm = findResource(
                            project.resources.algorithms,
                            elementDescriptor(project, e).algorithm,
                        );
                        for (const pass of this.packets.get(e.id)!.passes)
                            this.gpu.draw(
                                renderer,
                                algorithm,
                                pass,
                                undefined,
                                (inputId, slot) => this.media.texture(e.id, inputId, slot),
                                {
                                    camera: this.cameras.get(scene.id)!,
                                    transform: e.transform3d ?? defaultTransform3d(),
                                },
                            );
                    }
                    let image = this.worldTarget;
                    for (const effect of effectsFor(project, scene.id, input.timeSeconds, true))
                        if (this.packets.has(effect.id)) image = this.drawElement(project, effect, image)!;
                    this.copy(image, this.accumulation, true);
                    hashes.push(
                        JSON.stringify(scene.camera),
                        JSON.stringify(this.cameras.get(scene.id)),
                        ...visible.map(e => JSON.stringify(e.transform3d)),
                    );
                    continue;
                }
                const e = effective.find(e => e.id === unit.id)!;
                const range = elementRange(project, e);
                if (
                    !e.enabled ||
                    elementDescriptor(project, e).kind !== 'visual' ||
                    !range ||
                    input.timeSeconds < range.startSeconds ||
                    input.timeSeconds > range.endSeconds ||
                    !this.packets.has(e.id)
                )
                    continue;
                let current = this.drawElement(project, e);
                if (!current) continue;
                for (const effect of effectsFor(project, e.id, input.timeSeconds))
                    if (this.packets.has(effect.id)) current = this.drawElement(project, effect, current);
                this.copy(current!, this.accumulation, true);
            }
            let current = this.accumulation;
            for (const effect of effectsFor(project, null, input.timeSeconds))
                if (this.packets.has(effect.id)) current = this.drawElement(project, effect, current)!;
            this.copy(current, null, false, true);
            for (const [id, packet] of this.packets) {
                const element = project.elements.find(e => e.id === id)!;
                hashes.push(
                    id,
                    elementDescriptor(project, element).algorithm.hash,
                    JSON.stringify(element.bindings.map(b => input.values.get(parameterKey(id, b.parameterId))?.value)),
                    JSON.stringify(packet.state ?? []),
                    ...(element.mediaBindings ? [JSON.stringify(element.mediaBindings)] : []),
                );
            }
            return { hash: hashText(hashes.join('|')), needsSourcePrompt: this.needsSourcePrompt };
        } finally {
            renderer.setRenderTarget(null);
            renderer.autoClear = previousAutoClear;
        }
    }
    resize(width: number, height: number, dpr: number) {
        this.width = Math.max(1, Math.round(width * dpr));
        this.height = Math.max(1, Math.round(height * dpr));
        this.gpu.resize(this.width, this.height);
        for (const target of [...this.targets, this.accumulation, this.worldTarget])
            target.setSize(this.width, this.height);
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.runtime?.dispose();
        this.runtime = null;
        this.media.dispose();
        this.gpu.dispose();
        this.geometry.dispose();
        this.material.dispose();
        this.scene.clear();
        for (const target of [...this.targets, this.accumulation, this.worldTarget]) target.dispose();
        this.packets.clear();
        this.cameras.clear();
    }
}

function aWorldCamera(project: CompositionRenderModel, element: VisualizerElement, cameras: Map<string, CameraFrame>) {
    const scene = elementScene(project, element.id);
    return scene ? { camera: cameras.get(scene.id)! } : {};
}
