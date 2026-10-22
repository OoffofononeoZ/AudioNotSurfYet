import { hashBytes } from '../processing/sha256';
import { CompositionMediaHost } from './mediaHost';
import { validateMediaAssets, validateMediaBindings } from './mediaCodec';
import type { MediaAsset, MediaInputDefinition, MediaBinding } from './mediaTypes';
export async function importMediaFiles(files: File[], definition: MediaInputDefinition, signal: AbortSignal) {
    signal.throwIfAborted();
    const host = new CompositionMediaHost(),
        abort = () => host.dispose();
    signal.addEventListener('abort', abort, { once: true });
    try {
        const assets: MediaAsset[] = [];
        for (const file of files) {
            signal.throwIfAborted();
            const bytes = new Uint8Array(await file.arrayBuffer());
            let binary = '';
            for (let offset = 0; offset < bytes.length; offset += 32768)
                binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
            const raw = { id: hashBytes(bytes), name: file.name, mimeType: file.type, data: btoa(binary) };
            const [asset] = validateMediaAssets([raw])!;
            assets.push(asset!);
        }
        const unique = [...new Map(assets.map(a => [a.id, a])).values()];
        const binding: MediaBinding = {
            kind: 'media',
            assetIds: unique.map(a => a.id),
            fit: 'cover',
            intervalSeconds: 10,
            crossfadeSeconds: 1,
        };
        validateMediaBindings({ [definition.id]: binding }, [definition], unique);
        for (const asset of unique) {
            await host.probe(asset);
            signal.throwIfAborted();
        }
        return { assets: unique, binding };
    } finally {
        signal.removeEventListener('abort', abort);
        host.dispose();
    }
}
