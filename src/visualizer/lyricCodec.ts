import { hashBytes } from '../processing/sha256';
import { mediaBytes } from './mediaCodec';
import { parseLrc } from './lrcParser';
import { finite, invalid, keys, record, text } from './projectValidation';
import type { LyricAsset, LyricBinding, LyricBindings, LyricInputContract, LyricInputDefinition } from './lyricTypes';

export function validateLyricInputs(input: unknown): LyricInputContract[] | undefined {
    if (input === undefined) return undefined;
    if (!Array.isArray(input) || !input.length) return invalid('歌词输入声明无效。');
    const result = input.map(raw => {
        const v = record(raw, '歌词输入');
        keys(v, ['id']);
        const id = text(v.id, '歌词输入 ID');
        if (!/^[a-z][a-z0-9-]*$/u.test(id) || ['constructor', 'prototype', '__proto__'].includes(id))
            invalid('歌词输入 ID 无效。');
        return { id };
    });
    if (new Set(result.map(i => i.id)).size !== result.length) invalid('歌词输入重复。');
    return result;
}
export function validateLyricDefinitions(
    input: unknown,
    contract?: LyricInputContract[],
): LyricInputDefinition[] | undefined {
    if (!contract) {
        if (input !== undefined) invalid('算法未声明歌词输入。');
        return undefined;
    }
    if (!Array.isArray(input) || input.length !== contract.length) return invalid('歌词输入定义不完整。');
    return input.map((raw, index) => {
        const v = record(raw, '歌词输入定义');
        keys(v, ['id', 'label']);
        if (v.id !== contract[index]!.id) invalid('歌词输入超出算法声明。');
        return { id: String(v.id), label: text(v.label, '歌词输入名称') };
    });
}
const checked = new WeakSet<object>();
export function lyricText(asset: LyricAsset): string {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(mediaBytes(asset));
    } catch {
        throw Error('歌词文件必须使用 UTF-8 编码。');
    }
}
export function validateLyricAssets(input: unknown): LyricAsset[] | undefined {
    if (input === undefined) return undefined;
    if (!Array.isArray(input)) return invalid('歌词素材表无效。');
    const result = input.map(raw => {
        if (raw && checked.has(raw) && Object.isFrozen(raw)) return raw as LyricAsset;
        const v = record(raw, '歌词素材');
        keys(v, ['id', 'name', 'data']);
        const bytes = mediaBytes(v as unknown as LyricAsset);
        if (bytes.length > 2 * 1024 * 1024) invalid('LRC 文件超过 2MiB。');
        if (v.id !== hashBytes(bytes)) invalid('歌词内容与 SHA-256 不匹配。');
        const asset = Object.freeze({ id: String(v.id), name: text(v.name, '歌词文件名'), data: String(v.data) });
        const cues = parseLrc(lyricText(asset));
        if (cues.length > 10000) invalid('LRC 超过一万条时间记录。');
        checked.add(asset);
        return asset;
    });
    if (new Set(result.map(a => a.id)).size !== result.length) invalid('歌词素材重复。');
    return result;
}
export const defaultLyricBindings = (inputs?: LyricInputContract[]): LyricBindings | undefined =>
    inputs ? Object.fromEntries(inputs.map(i => [i.id, { kind: 'unbound' }])) : undefined;
export function validateLyricBindings(
    input: unknown,
    definitions?: LyricInputContract[],
    assets: LyricAsset[] = [],
    template = false,
): LyricBindings | undefined {
    if (!definitions) {
        if (input !== undefined) invalid('元素未声明歌词输入。');
        return undefined;
    }
    const v = record(input, '歌词绑定');
    keys(
        v,
        definitions.map(i => i.id),
    );
    return Object.fromEntries(
        definitions.map(d => {
            const b = record(v[d.id], '歌词绑定');
            if (b.kind === 'unbound') {
                keys(b, ['kind']);
                return [d.id, { kind: 'unbound' } as LyricBinding];
            }
            keys(b, ['kind', 'assetId', 'leadSeconds', 'tailSeconds', 'offsetSeconds']);
            if (template || b.kind !== 'lyrics' || !assets.some(a => a.id === b.assetId))
                invalid('歌词素材缺失或绑定无效。');
            const leadSeconds = finite(b.leadSeconds, '入场时长'),
                tailSeconds = finite(b.tailSeconds, '离场时长'),
                offsetSeconds = finite(b.offsetSeconds, '歌词时移');
            if (leadSeconds <= 0 || tailSeconds <= 0) invalid('歌词入场和离场时长必须大于零。');
            return [
                d.id,
                { kind: 'lyrics', assetId: String(b.assetId), leadSeconds, tailSeconds, offsetSeconds } as LyricBinding,
            ];
        }),
    );
}
export function referencedLyrics(elements: { lyricBindings?: LyricBindings }[], assets: LyricAsset[] = []) {
    const ids = new Set(
        elements.flatMap(e =>
            Object.values(e.lyricBindings ?? {}).flatMap(b => (b.kind === 'lyrics' ? [b.assetId] : [])),
        ),
    );
    return assets.filter(a => ids.has(a.id));
}
