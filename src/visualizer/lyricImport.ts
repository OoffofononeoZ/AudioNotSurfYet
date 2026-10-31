import { hashBytes } from '../processing/sha256';
import { validateLyricAssets } from './lyricCodec';
import type { LyricBinding } from './lyricTypes';
export async function importLyricFile(file: File, signal: AbortSignal, defaultLeadSeconds = 2) {
    if (!Number.isFinite(defaultLeadSeconds) || defaultLeadSeconds <= 0) throw Error('默认提前入场必须大于零。');
    signal.throwIfAborted();
    if (file.size > 2 * 1024 * 1024) throw Error('LRC 文件超过 2MiB。');
    const bytes = new Uint8Array(await file.arrayBuffer());
    signal.throwIfAborted();
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    const assets = validateLyricAssets([{ id: hashBytes(bytes), name: file.name, data: btoa(binary) }])!;
    const binding: LyricBinding = {
        kind: 'lyrics',
        assetId: assets[0]!.id,
        leadSeconds: defaultLeadSeconds,
        tailSeconds: 1.5,
        offsetSeconds: 0,
    };
    return { assets, binding };
}
