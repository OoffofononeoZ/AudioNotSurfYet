import type { Page } from '@playwright/test';

export interface V6ResourceSnapshot {
    audioContextsCreated: number;
    liveAudioContexts: number;
    workersCreated: number;
    liveWorkers: number;
    rafRequested: number;
    rafCompleted: number;
    liveRafs: number;
    webglContextsCreated: number;
    webglContextsLost: number;
    liveWebglContexts: number;
    mediaTracksObserved: number;
    liveMediaTracks: number;
    observersCreated: number;
    observersDisconnected: number;
    liveObservers: number;
    listenersAdded: number;
    listenersRemoved: number;
    liveListeners: number;
    blobUrlsCreated: number;
    blobUrlsRevoked: number;
    liveBlobUrls: number;
    canvasesInDocument: number;
    visualizerCanvases: number;
    visualizerHosts: number;
    visualizerRenderers: number;
    visualizerRafs: number;
    recordingResources: number;
}

export const installV6ResourceProbe = async (page: Page): Promise<void> => {
    await page.addInitScript(() => {
        const target = window as typeof window & {
            __V6_RESOURCE_PROBE__?: { snapshot(): V6ResourceSnapshot };
            __VISUALIZER_DIAGNOSTICS__?: {
                activeHosts: number;
                activeRenderers: number;
                activeVisualAnimationFrames: number;
                activeRecordingTaps: number;
                activeMediaRecorders: number;
                activeCaptureStreams: number;
                activeAudioTracks: number;
                activeVideoTracks: number;
                readyRecordingBlobs: number;
            };
        };
        const audioContexts = new Set<AudioContext>();
        const workers = new Set<Worker>();
        const rafs = new Set<number>();
        const webglContexts = new Set<object>();
        const lostWebglContexts = new Set<object>();
        const mediaTracks = new Set<MediaStreamTrack>();
        const observers = new Set<object>();
        const listenerKeys = new Set<string>();
        const blobUrls = new Set<string>();
        const objectIds = new WeakMap<object, number>();
        let nextObjectId = 1;
        let audioContextsCreated = 0;
        let workersCreated = 0;
        let rafRequested = 0;
        let rafCompleted = 0;
        let webglContextsCreated = 0;
        let webglContextsLost = 0;
        let mediaTracksObserved = 0;
        let observersCreated = 0;
        let observersDisconnected = 0;
        let listenersAdded = 0;
        let listenersRemoved = 0;
        let blobUrlsCreated = 0;
        let blobUrlsRevoked = 0;
        const objectId = (value: object) => {
            let id = objectIds.get(value);
            if (id === undefined) {
                id = nextObjectId++;
                objectIds.set(value, id);
            }
            return id;
        };

        const NativeAudioContext = window.AudioContext;
        if (NativeAudioContext) {
            window.AudioContext = new Proxy(NativeAudioContext, {
                construct(constructor, args, newTarget) {
                    const context = Reflect.construct(constructor, args, newTarget) as AudioContext;
                    audioContextsCreated += 1;
                    audioContexts.add(context);
                    const nativeClose = context.close.bind(context);
                    context.close = async () => {
                        const result = await nativeClose();
                        audioContexts.delete(context);
                        return result;
                    };
                    return context;
                },
            });
        }

        const NativeWorker = window.Worker;
        if (NativeWorker) {
            window.Worker = new Proxy(NativeWorker, {
                construct(constructor, args, newTarget) {
                    const worker = Reflect.construct(constructor, args, newTarget) as Worker;
                    workersCreated += 1;
                    workers.add(worker);
                    const nativeTerminate = worker.terminate.bind(worker);
                    worker.terminate = () => {
                        workers.delete(worker);
                        nativeTerminate();
                    };
                    return worker;
                },
            });
        }

        const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
        const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
        window.requestAnimationFrame = (callback) => {
            let handle = 0;
            handle = nativeRequestAnimationFrame((time) => {
                rafs.delete(handle);
                rafCompleted += 1;
                callback(time);
            });
            rafRequested += 1;
            rafs.add(handle);
            return handle;
        };
        window.cancelAnimationFrame = (handle) => {
            rafs.delete(handle);
            nativeCancelAnimationFrame(handle);
        };

        const nativeGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function getContext(
            this: HTMLCanvasElement,
            contextId: string,
            ...args: unknown[]
        ) {
            const context = Reflect.apply(nativeGetContext, this, [contextId, ...args]) as
                RenderingContext | null;
            if (
                context
                && ['webgl', 'webgl2', 'experimental-webgl'].includes(contextId)
                && !webglContexts.has(context as object)
            ) {
                const webgl = context as WebGLRenderingContext;
                webglContextsCreated += 1;
                webglContexts.add(webgl);
                const nativeGetExtension = webgl.getExtension.bind(webgl);
                webgl.getExtension = ((name: string) => {
                    const extension = nativeGetExtension(name);
                    if (name === 'WEBGL_lose_context' && extension) {
                        const value = extension as WEBGL_lose_context & { __v6Wrapped?: boolean };
                        if (!value.__v6Wrapped) {
                            const nativeLose = value.loseContext.bind(value);
                            const nativeRestore = value.restoreContext.bind(value);
                            value.loseContext = () => {
                                webglContextsLost += 1;
                                lostWebglContexts.add(webgl);
                                nativeLose();
                            };
                            value.restoreContext = () => {
                                lostWebglContexts.delete(webgl);
                                nativeRestore();
                            };
                            value.__v6Wrapped = true;
                        }
                    }
                    return extension;
                }) as typeof webgl.getExtension;
            }
            return context;
        } as typeof HTMLCanvasElement.prototype.getContext;

        const nativeGetTracks = MediaStream.prototype.getTracks;
        MediaStream.prototype.getTracks = function getTracks(this: MediaStream) {
            const tracks = nativeGetTracks.call(this);
            for (const track of tracks) {
                if (mediaTracks.has(track)) continue;
                mediaTracksObserved += 1;
                if (track.readyState === 'live') mediaTracks.add(track);
                const nativeStop = track.stop.bind(track);
                track.stop = () => {
                    mediaTracks.delete(track);
                    nativeStop();
                };
                track.addEventListener('ended', () => mediaTracks.delete(track), { once: true });
            }
            return tracks;
        };

        const wrapObserver = <T extends { disconnect(): void }>(
            key: 'ResizeObserver' | 'MutationObserver' | 'IntersectionObserver' | 'PerformanceObserver',
        ) => {
            const NativeObserver = window[key] as unknown as new (...args: unknown[]) => T;
            if (!NativeObserver) return;
            (window as unknown as Record<string, unknown>)[key] = new Proxy(NativeObserver, {
                construct(constructor, args, newTarget) {
                    const observer = Reflect.construct(constructor, args, newTarget) as T;
                    observersCreated += 1;
                    observers.add(observer);
                    const nativeDisconnect = observer.disconnect.bind(observer);
                    observer.disconnect = () => {
                        if (observers.delete(observer)) observersDisconnected += 1;
                        nativeDisconnect();
                    };
                    return observer;
                },
            });
        };
        wrapObserver('ResizeObserver');
        wrapObserver('MutationObserver');
        wrapObserver('IntersectionObserver');
        wrapObserver('PerformanceObserver');

        const nativeAddEventListener = EventTarget.prototype.addEventListener;
        const nativeRemoveEventListener = EventTarget.prototype.removeEventListener;
        EventTarget.prototype.addEventListener = function addEventListener(
            this: EventTarget,
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions,
        ) {
            if (listener) {
                const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
                const once = typeof options === 'object' && options?.once === true;
                const key = `${objectId(this)}:${type}:${objectId(listener)}:${capture}`;
                const persistentTarget = this === window || this === document;
                if (persistentTarget && !once && !listenerKeys.has(key)) {
                    listenerKeys.add(key);
                }
                listenersAdded += 1;
            }
            nativeAddEventListener.call(this, type, listener, options);
        };
        EventTarget.prototype.removeEventListener = function removeEventListener(
            this: EventTarget,
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | EventListenerOptions,
        ) {
            if (listener) {
                const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
                const key = `${objectId(this)}:${type}:${objectId(listener)}:${capture}`;
                if (listenerKeys.delete(key)) listenersRemoved += 1;
            }
            nativeRemoveEventListener.call(this, type, listener, options);
        };

        const nativeCreateObjectUrl = URL.createObjectURL.bind(URL);
        const nativeRevokeObjectUrl = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = (object) => {
            const url = nativeCreateObjectUrl(object);
            blobUrlsCreated += 1;
            blobUrls.add(url);
            return url;
        };
        URL.revokeObjectURL = (url) => {
            if (blobUrls.delete(url)) blobUrlsRevoked += 1;
            nativeRevokeObjectUrl(url);
        };

        target.__V6_RESOURCE_PROBE__ = {
            snapshot: () => {
                const diagnostics = target.__VISUALIZER_DIAGNOSTICS__;
                const recordingResources = diagnostics
                    ? diagnostics.activeRecordingTaps
                        + diagnostics.activeMediaRecorders
                        + diagnostics.activeCaptureStreams
                        + diagnostics.activeAudioTracks
                        + diagnostics.activeVideoTracks
                        + diagnostics.readyRecordingBlobs
                    : 0;
                return {
                    audioContextsCreated,
                    liveAudioContexts: audioContexts.size,
                    workersCreated,
                    liveWorkers: workers.size,
                    rafRequested,
                    rafCompleted,
                    liveRafs: rafs.size,
                    webglContextsCreated,
                    webglContextsLost,
                    liveWebglContexts: webglContexts.size - lostWebglContexts.size,
                    mediaTracksObserved,
                    liveMediaTracks: mediaTracks.size,
                    observersCreated,
                    observersDisconnected,
                    liveObservers: observers.size,
                    listenersAdded,
                    listenersRemoved,
                    liveListeners: listenerKeys.size,
                    blobUrlsCreated,
                    blobUrlsRevoked,
                    liveBlobUrls: blobUrls.size,
                    canvasesInDocument: document.querySelectorAll('canvas').length,
                    visualizerCanvases: document.querySelectorAll(
                        '[data-testid="visualizer-preview-canvas"]',
                    ).length,
                    visualizerHosts: diagnostics?.activeHosts ?? 0,
                    visualizerRenderers: diagnostics?.activeRenderers ?? 0,
                    visualizerRafs: diagnostics?.activeVisualAnimationFrames ?? 0,
                    recordingResources,
                };
            },
        };
    });
};

export const readV6ResourceProbe = (page: Page): Promise<V6ResourceSnapshot> =>
    page.evaluate(() => (
        window as typeof window & {
            __V6_RESOURCE_PROBE__: { snapshot(): V6ResourceSnapshot };
        }
    ).__V6_RESOURCE_PROBE__.snapshot());
