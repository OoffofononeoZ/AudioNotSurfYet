import { onBeforeUnmount, watch, ref, type Ref } from 'vue';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type { VisualizerSessionController } from './visualizerSessionController';
import { VisualizerRendererHost } from './visualizerRendererHost';
import { CompositionScene, type CompositionRenderPort } from './compositionScene';
import type { CompositionSessionSnapshot } from './compositionTypes';
import type { VisualizerRendererStatus } from './rendererTypes';
import { parameterKey } from './compositionEffects';
import { effectiveElements } from './compositionModel';
import { validateAlgorithmPrograms } from './validateAlgorithmPrograms';
export function useVisualizerPreview(
    canvas: Ref<HTMLCanvasElement | null>,
    controller: VisualizerSessionController,
    store: ReturnType<typeof useAudioSessionStore>,
    snapshot: Ref<CompositionSessionSnapshot>,
) {
    const status = ref<VisualizerRendererStatus>({ state: 'idle' });
    let host: VisualizerRendererHost | null = null,
        observer: ResizeObserver | null = null,
        detach: (() => void) | null = null;
    const nativeStatus = ref('idle'),
        nativeMessage = ref('');
    let detachNative: (() => void) | null = null;
    let detachAlgorithms: (() => void) | null = null;
    const cleanup = () => {
        observer?.disconnect();
        observer = null;
        detach?.();
        detach = null;
        detachNative?.();
        detachNative = null;
        detachAlgorithms?.();
        detachAlgorithms = null;
        host?.dispose();
        host = null;
    };
    watch(
        canvas,
        element => {
            cleanup();
            if (!element) return;
            try {
                host = new VisualizerRendererHost({
                    canvas: element,
                    createScene: surface =>
                        new CompositionScene({
                            renderer: surface.renderer as CompositionRenderPort,
                            readProject: () => controller.readProject(),
                            resolveAt: t => controller.resolveValuesAt(t),
                        }),
                    readFrame: () => {
                        const p = controller.readProject();
                        return p
                            ? {
                                  trackIdentity: p.track.contentHash,
                                  seed: p.seed,
                                  timeSeconds: store.playback.currentTimeSeconds,
                                  bindingRevision: snapshot.value.bindingRuntime.bindingRevision,
                                  playbackState: store.playback.state,
                              }
                            : null;
                    },
                    resolveValuesAt: t => controller.resolveValuesAt(t),
                    onFrame(values) {
                        const project = controller.readProject();
                        const inputs = project
                            ? effectiveElements(project)
                                  .filter(e => e.enabled)
                                  .flatMap(e =>
                                      e.bindings
                                          .filter(b => b.source.kind === 'native')
                                          .map(b => values.get(parameterKey(e.id, b.parameterId))),
                                  )
                            : [];
                        nativeStatus.value = inputs.some(v => v?.state === 'error')
                            ? 'error'
                            : inputs.some(v => v?.state !== 'ready')
                              ? 'loading'
                              : inputs.length
                                ? 'ready'
                                : 'idle';
                        nativeMessage.value = inputs.find(v => v?.state === 'error')?.message ?? '';
                        element.dataset.nativeInputState = nativeStatus.value;
                    },
                    onStatus: value => {
                        status.value = value;
                        controller.notifyRendererStatus(value);
                    },
                });
                const target = host;
                detachAlgorithms = controller.attachAlgorithmValidator(resources =>
                    validateAlgorithmPrograms(target.renderer, resources),
                );
                detach = controller.attachExportTarget({
                    getStatus: () => status.value,
                    acquireExportSurface: (w, h) => target.acquireExportSurface(w, h),
                });
                detachNative = controller.subscribeNativeInput(() => target.requestFrame());
                observer = new ResizeObserver(() => {
                    const rect = element.getBoundingClientRect();
                    target.resize(rect.width, rect.height);
                });
                observer.observe(element);
                const rect = element.getBoundingClientRect();
                target.resize(rect.width, rect.height);
            } catch (error) {
                cleanup();
                status.value = { state: 'error', message: (error as Error).message };
            }
        },
        { flush: 'post' },
    );
    watch(
        () => [
            snapshot.value.bindingRuntime.bindingRevision,
            snapshot.value.project?.seed,
            store.playback.state,
            store.playback.currentTimeSeconds,
        ],
        () => host?.requestFrame(),
    );
    watch(
        () => store.playback.currentTimeSeconds,
        (time, previous) => {
            if (time < previous || Math.abs(time - previous) > 0.5 || store.playback.state !== 'playing')
                host?.invalidateFrame();
        },
        { flush: 'sync' },
    );
    onBeforeUnmount(cleanup);
    return { status, nativeStatus, nativeMessage, retry: () => host?.retry() };
}
