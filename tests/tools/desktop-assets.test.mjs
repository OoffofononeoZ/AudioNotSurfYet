import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { copyDesktopPublicAssets } from '../../scripts/lib/desktop-assets.mjs';
import { fixture, write } from './fixture.mjs';

test('desktop staging excludes ignored personal media, diagnostics and undeclared runtime files', async t => {
    const root = fixture(t, {
        'src/processing/runtime-manifest.json': JSON.stringify({ assets: [{ file: 'ort.test.wasm' }] }),
        'public/audios/personal.wav': 'private audio',
        'public/test_audio/fixture.wav': 'test audio',
        'public/processing-probe/graph.onnx': 'diagnostic model',
        'public/processing-runtime/unlisted.onnx': 'not a product runtime',
        'public/processing-runtime/ort.test.wasm': 'pinned wasm',
    });
    for (const file of [
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
    ])
        write(root, `public/${file}`, 'product asset');
    const destination = path.join(root, 'artifacts/desktop/renderer');
    await copyDesktopPublicAssets(root, destination);
    assert.equal(await fs.readFile(path.join(destination, 'processing-runtime/ort.test.wasm'), 'utf8'), 'pinned wasm');
    for (const file of ['audios', 'test_audio', 'processing-probe', 'processing-runtime/unlisted.onnx']) {
        await assert.rejects(fs.access(path.join(destination, file)), { code: 'ENOENT' });
    }
    assert.equal(await fs.readFile(path.join(root, 'public/audios/personal.wav'), 'utf8'), 'private audio');
});
