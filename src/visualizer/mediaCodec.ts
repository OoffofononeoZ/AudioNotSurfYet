import { hashBytes } from '../processing/sha256';
import { finite, invalid, keys, record, text } from './projectValidation';
import type { MediaAsset, MediaBinding, MediaBindings, MediaInputContract, MediaInputDefinition } from './mediaTypes';
const identifier = (v: unknown) => {
    const id = text(v, '媒体输入 ID');
    if (!/^[a-z][a-z0-9-]*$/.test(id) || ['constructor', 'prototype', '__proto__'].includes(id))
        return invalid('媒体输入 ID 无效。');
    return id;
};
export function validateMediaInputs(input: unknown): MediaInputContract[] | undefined {
    if (input === undefined) return undefined;
    if (!Array.isArray(input) || !input.length) return invalid('媒体输入声明无效。');
    const result = input.map(raw => {
        const v = record(raw, '媒体输入');
        keys(v, ['id', 'kinds', 'multiple']);
        if (
            !Array.isArray(v.kinds) ||
            !v.kinds.length ||
            new Set(v.kinds).size !== v.kinds.length ||
            v.kinds.some(k => !['image', 'video'].includes(k)) ||
            typeof v.multiple !== 'boolean'
        )
            return invalid('媒体输入能力无效。');
        return { id: identifier(v.id), kinds: [...v.kinds] as ('image' | 'video')[], multiple: v.multiple };
    });
    if (new Set(result.map(i => i.id)).size !== result.length) return invalid('媒体输入重复。');
    return result;
}
export function validateMediaDefinitions(
    input: unknown,
    contract?: MediaInputContract[],
): MediaInputDefinition[] | undefined {
    if (!contract) {
        if (input !== undefined) return invalid('算法未声明媒体输入。');
        return undefined;
    }
    if (!Array.isArray(input) || input.length !== contract.length) return invalid('媒体输入定义不完整。');
    return input.map((raw, i) => {
        const v = record(raw, '媒体输入定义');
        keys(v, ['id', 'kinds', 'multiple', 'label']);
        const c = contract[i]!;
        const [definition] = validateMediaInputs([{ id: v.id, kinds: v.kinds, multiple: v.multiple }])!;
        if (
            definition!.id !== c.id ||
            definition!.kinds.some(k => !c.kinds.includes(k)) ||
            (definition!.multiple && !c.multiple)
        )
            return invalid('媒体输入超出算法能力。');
        return { ...definition!, label: text(v.label, '媒体输入名称') };
    });
}
export function mediaBytes(asset: Pick<MediaAsset, 'data'>): Uint8Array {
    if (
        typeof asset.data !== 'string' ||
        !asset.data.length ||
        asset.data.length % 4 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data)
    )
        return invalid('媒体 Base64 无效。');
    const s = atob(asset.data);
    return Uint8Array.from(s, c => c.charCodeAt(0));
}
const checked = new WeakSet<object>();
export function validateMediaAssets(input: unknown): MediaAsset[] | undefined {
    if (input === undefined) return undefined;
    if (!Array.isArray(input)) return invalid('媒体素材表无效。');
    const result = input.map(raw => {
        if (raw && checked.has(raw) && Object.isFrozen(raw)) return raw as MediaAsset;
        const v = record(raw, '媒体素材');
        keys(v, ['id', 'name', 'mimeType', 'data']);
        if (
            typeof v.id !== 'string' ||
            !/^[a-f0-9]{64}$/.test(v.id) ||
            !['image/png', 'image/jpeg', 'image/webp', 'video/webm', 'video/mp4'].includes(String(v.mimeType))
        )
            return invalid('媒体身份或格式无效。');
        if (hashBytes(mediaBytes(v as unknown as MediaAsset)) !== v.id) return invalid('媒体内容与 SHA-256 不匹配。');
        const asset = Object.freeze({
            id: v.id,
            name: text(v.name, '媒体名称'),
            mimeType: v.mimeType as MediaAsset['mimeType'],
            data: String(v.data),
        });
        checked.add(asset);
        return asset;
    });
    if (new Set(result.map(a => a.id)).size !== result.length) return invalid('媒体素材重复。');
    return result;
}
export function defaultMediaBindings(inputs?: MediaInputContract[]): MediaBindings | undefined {
    return inputs ? Object.fromEntries(inputs.map(i => [i.id, { kind: 'none' }])) : undefined;
}
export function validateMediaBindings(
    input: unknown,
    definitions?: MediaInputContract[],
    assets: MediaAsset[] = [],
    template = false,
): MediaBindings | undefined {
    if (!definitions) {
        if (input !== undefined) return invalid('元素未声明媒体输入。');
        return undefined;
    }
    const v = record(input, '媒体绑定');
    keys(
        v,
        definitions.map(i => i.id),
    );
    return Object.fromEntries(
        definitions.map(d => {
            const b = record(v[d.id], '媒体绑定');
            if (b.kind === 'none') {
                keys(b, ['kind']);
                return [d.id, { kind: 'none' } as MediaBinding];
            }
            keys(b, ['kind', 'assetIds', 'fit', 'intervalSeconds', 'crossfadeSeconds']);
            if (
                template ||
                b.kind !== 'media' ||
                !Array.isArray(b.assetIds) ||
                !b.assetIds.length ||
                new Set(b.assetIds).size !== b.assetIds.length ||
                (!d.multiple && b.assetIds.length !== 1) ||
                !['cover', 'contain', 'initial'].includes(String(b.fit))
            )
                return invalid('媒体绑定无效。');
            const selected = b.assetIds.map(id => assets.find(a => a.id === id));
            if (
                selected.some(a => !a || !d.kinds.includes(a.mimeType.startsWith('image/') ? 'image' : 'video')) ||
                (selected.length > 1 && selected.some(a => a!.mimeType.startsWith('video/')))
            )
                return invalid('媒体缺失或不符合输入能力。');
            const intervalSeconds = finite(b.intervalSeconds, '轮播间隔'),
                crossfadeSeconds = finite(b.crossfadeSeconds, '淡化时长');
            if (intervalSeconds <= 0 || crossfadeSeconds < 0 || crossfadeSeconds > intervalSeconds)
                return invalid('轮播时间无效。');
            return [
                d.id,
                {
                    kind: 'media',
                    assetIds: [...b.assetIds] as string[],
                    fit: b.fit,
                    intervalSeconds,
                    crossfadeSeconds,
                } as MediaBinding,
            ];
        }),
    );
}
export function referencedMedia(elements: { mediaBindings?: MediaBindings }[], assets: MediaAsset[] = []) {
    const ids = new Set(
        elements.flatMap(e =>
            Object.values(e.mediaBindings ?? {}).flatMap(b => (b.kind === 'media' ? b.assetIds : [])),
        ),
    );
    return assets.filter(a => ids.has(a.id));
}
