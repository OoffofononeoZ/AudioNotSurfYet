import fs from 'node:fs/promises';
import path from 'node:path';

/** Public directories can contain ignored personal audio. Copy only product assets. */
export async function copyDesktopPublicAssets(root, destination) {
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'src/processing/runtime-manifest.json'), 'utf8'));
    const files = [
        'default_cover.png',
        'icons.svg',
        'vite.svg',
        'licenses/mediabunny-MPL-2.0.txt',
        'processing-runtime/manifest.json',
        'processing-runtime/THIRD_PARTY_NOTICES.md',
        'processing-runtime/transcription/THIRD_PARTY_NOTICES.md',
        'processing-runtime/transcription/model-artifacts.json',
        'processing-runtime/transcription/licenses/BasicPitch-LICENSE.txt',
        'wallpaper-runtime/runtime.js',
        'wallpaper-runtime/THIRD_PARTY_LICENSES.txt',
    ];
    for (const asset of manifest.assets) {
        if (!/^[a-zA-Z0-9_.-]+$/.test(asset.file) || ['.', '..'].includes(asset.file)) {
            throw Error('Invalid pinned desktop runtime filename');
        }
        files.push(`processing-runtime/${asset.file}`);
    }
    for (const file of files) {
        const target = path.join(destination, file);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(path.join(root, 'public', file), target);
    }
    return files;
}
