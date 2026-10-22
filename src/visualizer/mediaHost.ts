import * as THREE from 'three';
import type { Input, VideoSampleSink, VideoSample } from 'mediabunny';
import type { CompositionRenderModel, VisualizerElement } from './compositionTypes';
import type { MediaAsset, MediaFrame, MediaFrameInfo } from './mediaTypes';
import { mediaBytes } from './mediaCodec';
import { mediaSelection, videoTime } from './mediaTimeline';
import { elementDescriptor, elementRange } from './compositionModel';

interface Loaded {
    texture: THREE.Texture;
    width: number;
    height: number;
    duration: number;
    image?: ImageBitmap;
    video?: HTMLVideoElement;
    url?: string;
    input?: Input;
    sink?: VideoSampleSink;
    sample?: VideoSample;
    timestamp?: number;
}
export const mediaHostDiagnostics = { assets: 0, textures: 0, videos: 0, inputs: 0 };
const emptyInfo: MediaFrameInfo = {
    available: false,
    width: 1,
    height: 1,
    nextWidth: 1,
    nextHeight: 1,
    mix: 0,
    fit: 'cover',
};
/** Only this host owns media bytes, native decoders and GPU textures. No pixel payload enters algorithm workers. */
export class CompositionMediaHost {
    private loaded = new Map<string, Promise<Loaded>>();
    private slots = new Map<string, THREE.Texture>();
    private abort = new AbortController();
    private blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    private disposed = false;
    constructor() {
        this.blank.needsUpdate = true;
    }
    texture(elementId: string, inputId: string, slot: 'current' | 'next') {
        return this.slots.get(elementId + ':' + inputId + ':' + slot) ?? this.blank;
    }
    private release(item: Loaded) {
        item.sample?.close();
        item.input?.dispose();
        item.image?.close();
        if (item.video) {
            item.video.pause();
            item.video.removeAttribute('src');
            item.video.load();
            mediaHostDiagnostics.videos--;
        }
        if (item.url) URL.revokeObjectURL(item.url);
        if (item.input) mediaHostDiagnostics.inputs--;
        item.texture.dispose();
        mediaHostDiagnostics.assets--;
        mediaHostDiagnostics.textures--;
    }
    private wait(video: HTMLVideoElement, event: 'loadeddata' | 'seeked') {
        const signal = this.abort.signal;
        return new Promise<void>((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout>;
            const clean = () => {
                clearTimeout(timer);
                video.removeEventListener(event, done);
                video.removeEventListener('error', fail);
                signal.removeEventListener('abort', cancel);
            };
            const done = () => {
                    clean();
                    resolve();
                },
                fail = () => {
                    clean();
                    reject(Error('视频无法解码。'));
                },
                cancel = () => {
                    clean();
                    reject(signal.reason ?? Error('媒体加载已取消。'));
                };
            video.addEventListener(event, done, { once: true });
            video.addEventListener('error', fail, { once: true });
            signal.addEventListener('abort', cancel, { once: true });
            timer = setTimeout(() => {
                clean();
                reject(Error('视频准备超时。'));
            }, 10000);
            if (signal.aborted) cancel();
        });
    }
    private async load(asset: MediaAsset, realtime: boolean): Promise<Loaded> {
        this.abort.signal.throwIfAborted();
        const blob = new Blob([mediaBytes(asset) as Uint8Array<ArrayBuffer>], { type: asset.mimeType });
        const texture = new THREE.Texture();
        // DrawPacket shaders and the compositor use display-encoded RGB, including color uniforms.
        // Avoid an implicit sRGB-to-linear decode that would darken midtone media.
        texture.colorSpace = THREE.NoColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        const item: Loaded = { texture, width: 1, height: 1, duration: 0 };
        mediaHostDiagnostics.assets++;
        mediaHostDiagnostics.textures++;
        try {
            if (asset.mimeType.startsWith('image/')) {
                const image = await createImageBitmap(blob, {
                    imageOrientation: 'flipY',
                    premultiplyAlpha: 'none',
                    colorSpaceConversion: 'none',
                });
                item.image = image;
                item.width = image.width;
                item.height = image.height;
                texture.image = image;
                texture.needsUpdate = true;
            } else if (realtime) {
                const video = document.createElement('video');
                item.video = video;
                mediaHostDiagnostics.videos++;
                video.muted = true;
                video.loop = true;
                video.playsInline = true;
                video.preload = 'auto';
                item.url = URL.createObjectURL(blob);
                const ready = this.wait(video, 'loadeddata');
                video.src = item.url;
                video.load();
                await ready;
                item.width = video.videoWidth;
                item.height = video.videoHeight;
                item.duration = video.duration;
                texture.dispose();
                item.texture = new THREE.VideoTexture(video);
                item.texture.colorSpace = THREE.NoColorSpace;
            } else {
                const { Input, BlobSource, ALL_FORMATS, VideoSampleSink } = await import('mediabunny');
                item.input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
                mediaHostDiagnostics.inputs++;
                const track = await item.input.getPrimaryVideoTrack();
                if (!track || !(await track.canDecode())) throw Error('当前浏览器不支持此视频编码。');
                item.duration = await track.computeDuration();
                item.width = track.displayWidth;
                item.height = track.displayHeight;
                item.sink = new VideoSampleSink(track);
            }
            this.abort.signal.throwIfAborted();
            if (
                !item.width ||
                !item.height ||
                (asset.mimeType.startsWith('video/') && (!Number.isFinite(item.duration) || item.duration <= 0))
            )
                throw Error('媒体尺寸或时长无效。');
            return item;
        } catch (error) {
            this.release(item);
            throw error;
        }
    }
    private async obtain(
        key: string,
        asset: MediaAsset,
        realtime: boolean,
        time: number,
        paused: boolean,
        used: Set<string>,
    ) {
        used.add(key);
        let pending = this.loaded.get(key);
        if (!pending) {
            pending = this.load(asset, realtime);
            this.loaded.set(key, pending);
        }
        const item = await pending;
        this.abort.signal.throwIfAborted();
        if (item.sink) {
            const at = videoTime(time, item.duration);
            if (at !== item.timestamp) {
                const sample = await item.sink.getSample(at);
                if (this.disposed) {
                    sample?.close();
                    this.abort.signal.throwIfAborted();
                }
                if (!sample) throw Error('目标时间没有可解码的视频帧。');
                item.sample?.close();
                item.sample = sample;
                item.timestamp = at;
                item.texture.image = sample.toCanvasImageSource();
                item.texture.needsUpdate = true;
            }
        } else if (item.video) {
            const video = item.video,
                at = videoTime(time, item.duration);
            if (Math.abs(video.currentTime - at) > 1 / 30 || (paused && Math.abs(video.currentTime - at) > 0.000001)) {
                const ready = this.wait(video, 'seeked');
                video.currentTime = at;
                await ready;
            }
            if (paused) video.pause();
            else if (video.paused) await video.play();
            this.abort.signal.throwIfAborted();
            item.texture.needsUpdate = true;
        }
        return item;
    }
    async prepare(
        project: CompositionRenderModel,
        elements: VisualizerElement[],
        time: number,
        realtime: boolean,
        paused = false,
    ) {
        this.abort.signal.throwIfAborted();
        this.slots.clear();
        const used = new Set<string>(),
            frames = new Map<string, MediaFrame>();
        for (const element of elements) {
            const frame: MediaFrame = {};
            for (const definition of elementDescriptor(project, element).mediaInputs ?? []) {
                const binding = element.mediaBindings?.[definition.id];
                if (!binding) throw Error('媒体输入尚未配置。');
                if (binding.kind === 'none') {
                    frame[definition.id] = { ...emptyInfo };
                    continue;
                }
                const local = realtime ? time : Math.max(0, time - (elementRange(project, element)?.startSeconds ?? 0));
                const selection = mediaSelection(binding, local);
                const assets = binding.assetIds.map(id => {
                    const asset = project.mediaAssets?.find(a => a.id === id);
                    if (!asset) throw Error('媒体素材缺失。');
                    return asset;
                });
                const selected =
                    assets.length === 1
                        ? [assets[0]!, assets[0]!]
                        : [assets[selection.current]!, assets[selection.next]!];
                const loaded: Loaded[] = [];
                for (const [i, asset] of selected.entries()) {
                    const slot = i === 0 ? 'current' : 'next';
                    const key = asset.mimeType.startsWith('image/')
                        ? 'image:' + asset.id
                        : element.id + ':' + definition.id + ':' + asset.id;
                    const item = await this.obtain(key, asset, realtime, local, paused, used);
                    loaded.push(item);
                    this.slots.set(element.id + ':' + definition.id + ':' + slot, item.texture);
                }
                frame[definition.id] = {
                    available: true,
                    width: loaded[0]!.width,
                    height: loaded[0]!.height,
                    nextWidth: loaded[1]!.width,
                    nextHeight: loaded[1]!.height,
                    mix: selection.mix,
                    fit: binding.fit,
                };
            }
            frames.set(element.id, frame);
        }
        this.abort.signal.throwIfAborted();
        for (const [key, pending] of this.loaded)
            if (!used.has(key)) {
                this.loaded.delete(key);
                void pending.then(
                    item => this.release(item),
                    () => {},
                );
            }
        return frames;
    }
    async probe(asset: MediaAsset) {
        const item = await this.load(asset, false);
        try {
            if (item.sink) {
                const sample = await item.sink.getSample(0);
                if (!sample) throw Error('视频首帧无法解码。');
                sample.close();
            }
        } finally {
            this.release(item);
        }
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.abort.abort(Error('媒体宿主已释放。'));
        for (const pending of this.loaded.values())
            void pending.then(
                item => this.release(item),
                () => {},
            );
        this.loaded.clear();
        this.slots.clear();
        this.blank.dispose();
    }
}
