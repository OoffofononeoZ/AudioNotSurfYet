import { hashBytes } from '../processing/sha256';
import { validateLyricAssets } from './lyricCodec';
import type { LyricBinding } from './lyricTypes';
export async function importLyricFile(file: File, signal: AbortSignal) {
    signal.throwIfAborted();
    const bytes = new Uint8Array(await file.arrayBuffer());
    signal.throwIfAborted();
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    const assets = validateLyricAssets([{ id: hashBytes(bytes), name: file.name, data: btoa(binary) }])!;
    const binding: LyricBinding = {
        kind: 'lyrics',
        assetId: assets[0]!.id,
        leadSeconds: 2,
        tailSeconds: 1.5,
        offsetSeconds: 0,
    };
    return { assets, binding };
}
