import * as THREE from 'three';
import { lyricText } from './lyricCodec';
import { parseLrc } from './lrcParser';
import { FrameSupersededError } from './framePreparation';
import type { CompositionRenderModel, VisualizerElement } from './compositionTypes';
import type { LyricCue, LyricFrame, LyricFrameInfo, LyricTokenFrame } from './lyricTypes';

const PAGE = 2048,
    HEIGHT = 88,
    FONT = '64px Arial, "Microsoft YaHei", sans-serif';
export const lyricHostDiagnostics = { textures: 0 };
type Atlas = {
    key: string;
    textures: THREE.Texture[];
    tokens: Map<string, Omit<LyricTokenFrame, 'index' | 'text' | 'time'>>;
};
export class CompositionLyricHost {
    private atlases = new Map<string, Atlas>();
    private documents = new Map<string, LyricCue[]>();
    private generation = 0;
    private disposed = false;
    texture(elementId: string, inputId: string, page: number): THREE.Texture {
        const texture = this.atlases.get(elementId + ':' + inputId)?.textures[page];
        if (!texture) throw Error('歌词图集页未获授权或已失效。');
        return texture;
    }
    private release(atlas: Atlas) {
        for (const texture of atlas.textures) {
            texture.dispose();
            const canvas = texture.image as HTMLCanvasElement;
            canvas.width = canvas.height = 1;
            texture.image = null;
            lyricHostDiagnostics.textures--;
        }
    }
    private build(key: string, words: string[]): Atlas {
        const canvases: HTMLCanvasElement[] = [],
            textures: THREE.Texture[] = [],
            tokens: Atlas['tokens'] = new Map();
        let x = 0,
            y = 0,
            page = -1;
        const addPage = () => {
            if (canvases.length >= 4) throw Error('当前歌词窗口超过四页图集，请缩短入场或离场时长。');
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = PAGE;
            canvases.push(canvas);
            page++;
            x = y = 0;
            const context = canvas.getContext('2d')!;
            context.font = FONT;
            context.fillStyle = '#ffffff';
            context.textBaseline = 'alphabetic';
            return context;
        };
        let context = addPage();
        try {
            for (const word of words) {
                const metrics = context.measureText(word);
                const width =
                    Math.ceil(
                        Math.max(metrics.width, metrics.actualBoundingBoxRight) +
                            Math.max(0, metrics.actualBoundingBoxLeft),
                    ) + 16;
                if (width > PAGE) throw Error('单个歌词词组过长，无法生成文字图集。');
                if (x + width > PAGE) {
                    x = 0;
                    y += HEIGHT;
                }
                if (y + HEIGHT > PAGE) context = addPage();
                context.fillText(word, x + 8 + Math.max(0, metrics.actualBoundingBoxLeft), y + 68);
                tokens.set(word, {
                    page,
                    uv: [x / PAGE, 1 - (y + HEIGHT) / PAGE, (x + width) / PAGE, 1 - y / PAGE],
                    width,
                    height: HEIGHT,
                });
                x += width;
            }
            for (const canvas of canvases) {
                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.NoColorSpace;
                texture.generateMipmaps = false;
                texture.minFilter = texture.magFilter = THREE.LinearFilter;
                textures.push(texture);
                lyricHostDiagnostics.textures++;
            }
            return { key, textures, tokens };
        } catch (error) {
            for (const texture of textures) {
                texture.dispose();
                lyricHostDiagnostics.textures--;
            }
            throw error;
        }
    }
    async prepare(
        project: CompositionRenderModel,
        elements: VisualizerElement[],
        time: number,
        isCurrent: () => boolean,
    ): Promise<Map<string, LyricFrame>> {
        const generation = ++this.generation;
        if (elements.some(e => Object.values(e.lyricBindings ?? {}).some(b => b.kind === 'lyrics')))
            await document.fonts.ready;
        if (this.disposed || generation !== this.generation || !isCurrent()) throw new FrameSupersededError();
        const frames = new Map<string, LyricFrame>(),
            used = new Set<string>(),
            assetIds = new Set<string>();
        for (const element of elements) {
            const frame: LyricFrame = {};
            for (const [id, binding] of Object.entries(element.lyricBindings ?? {})) {
                const key = element.id + ':' + id;
                const empty: LyricFrameInfo = {
                    available: false,
                    revision: 'unbound',
                    leadSeconds: 2,
                    tailSeconds: 1.5,
                    cues: [],
                };
                if (binding.kind !== 'lyrics') {
                    frame[id] = empty;
                    continue;
                }
                const asset = project.lyricAssets?.find(a => a.id === binding.assetId);
                if (!asset) throw Error('歌词素材缺失。');
                assetIds.add(asset.id);
                let cues = this.documents.get(asset.id);
                if (!cues) {
                    cues = parseLrc(lyricText(asset));
                    this.documents.set(asset.id, cues);
                }
                const selected = cues.filter(
                    c =>
                        c.tokens.length &&
                        c.time + binding.offsetSeconds - binding.leadSeconds <= time &&
                        c.end + binding.offsetSeconds + binding.tailSeconds >= time,
                );
                const words = [...new Set(selected.flatMap(c => c.tokens))].sort();
                const signature = JSON.stringify([asset.id, words]);
                let atlas = this.atlases.get(key);
                if (words.length) {
                    used.add(key);
                    if (atlas?.key !== signature) {
                        const replacement = this.build(signature, words);
                        if (atlas) this.release(atlas);
                        this.atlases.set(key, replacement);
                        atlas = replacement;
                    }
                }
                frame[id] = {
                    available: true,
                    revision: JSON.stringify(binding),
                    leadSeconds: binding.leadSeconds,
                    tailSeconds: binding.tailSeconds,
                    cues: selected.map(c => ({
                        index: c.index,
                        time: c.time + binding.offsetSeconds,
                        end: c.end + binding.offsetSeconds,
                        tokens: c.tokens.map((text, index) => ({
                            ...atlas!.tokens.get(text)!,
                            text,
                            index,
                            time: c.time + binding.offsetSeconds + (index * (c.end - c.time)) / c.tokens.length,
                        })),
                    })),
                };
            }
            if (Object.keys(frame).length) frames.set(element.id, frame);
        }
        for (const [key, atlas] of this.atlases)
            if (!used.has(key)) {
                this.release(atlas);
                this.atlases.delete(key);
            }
        for (const id of this.documents.keys()) if (!assetIds.has(id)) this.documents.delete(id);
        return frames;
    }
    dispose() {
        this.disposed = true;
        this.generation++;
        for (const atlas of this.atlases.values()) this.release(atlas);
        this.atlases.clear();
        this.documents.clear();
    }
}
