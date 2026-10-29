import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(root, 'artifacts/desktop');
const profile = path.join(artifacts, 'profiles', `smoke-${Date.now()}`);
const appRoot = path.join(artifacts, 'app');
const packaged = process.argv.includes('--packaged');
await fs.mkdir(profile, { recursive: true });
const env = {
    ...process.env,
    AUDIOSURF_DESKTOP_TEST_PROFILE: profile,
    TEMP: path.join(artifacts, 'build-temp'),
    TMP: path.join(artifacts, 'build-temp'),
};
delete env.ELECTRON_RUN_AS_NODE;
const errors = [];

async function launch() {
    const app = await _electron.launch({
        ...(packaged ? { executablePath: path.join(artifacts, 'packages/win-unpacked/AudioNotSurfYet.exe') } : {}),
        args: [`--user-data-dir=${profile}`, ...(!packaged ? [appRoot] : [])],
        cwd: root,
        env,
        timeout: 60_000,
    });
    const page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#main-layout', { timeout: 60_000 });
    return { app, page };
}

let current;
try {
    current = await launch();
    const security = await current.app.evaluate(({ BrowserWindow }) => {
        const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
        return {
            sandbox: preferences.sandbox,
            isolation: preferences.contextIsolation,
            node: preferences.nodeIntegration,
            workerNode: preferences.nodeIntegrationInWorker,
            versions: process.versions,
        };
    });
    assert.equal(security.sandbox, true);
    assert.equal(security.isolation, true);
    assert.equal(security.node, false);
    assert.equal(security.workerNode, false);
    const capability = await current.page.evaluate(async () => {
        if (typeof window.require !== 'undefined' || typeof window.process !== 'undefined')
            throw Error('Node globals leaked');
        if (window.audiosurfDesktop?.platform !== 'electron') throw Error('Preload bridge missing');
        if (!window.isSecureContext) throw Error('App protocol is not a secure context');
        const directory = await navigator.storage.getDirectory();
        const handle = await directory.getFileHandle('desktop-smoke-marker', { create: true });
        const stream = await handle.createWritable();
        await stream.write('persisted-desktop-smoke');
        await stream.close();
        if ((await (await handle.getFile()).text()) !== 'persisted-desktop-smoke') throw Error('OPFS roundtrip failed');
        if (!navigator.locks) throw Error('Web Locks unavailable');
        const adapter = await navigator.gpu?.requestAdapter({
            powerPreference: 'high-performance',
            forceFallbackAdapter: false,
        });
        if (!adapter || adapter.info.isFallbackAdapter) throw Error('Hardware WebGPU adapter unavailable');
        const device = await adapter.requestDevice();
        device.destroy();
        if (!document.createElement('canvas').getContext('webgl2')) throw Error('WebGL2 unavailable');
        const ort = await import('/processing-runtime/ort.all.min.mjs');
        if (typeof ort.InferenceSession.create !== 'function') throw Error('Pinned ORT module missing');
        const codecs = [];
        for (const codec of ['vp09.00.10.08', 'vp8']) {
            if (
                (
                    await VideoEncoder.isConfigSupported({
                        codec,
                        width: 64,
                        height: 64,
                        bitrate: 100_000,
                        framerate: 30,
                    })
                ).supported
            )
                codecs.push(codec);
        }
        if (!codecs.length) throw Error('VP9/VP8 encoding unavailable');
        let videoChunks = 0,
            audioChunks = 0;
        let encodeError;
        const video = new VideoEncoder({
            output: () => videoChunks++,
            error: error => {
                encodeError = error;
            },
        });
        video.configure({ codec: codecs[0], width: 64, height: 64, bitrate: 100_000, framerate: 30 });
        const canvas = new OffscreenCanvas(64, 64);
        canvas.getContext('2d').fillRect(0, 0, 64, 64);
        for (let index = 0; index < 3; index++) {
            const frame = new VideoFrame(canvas, {
                timestamp: Math.round((index * 1e6) / 30),
                duration: 33333,
            });
            video.encode(frame);
            frame.close();
        }
        await video.flush();
        video.close();
        const audio = new AudioEncoder({
            output: () => audioChunks++,
            error: error => {
                encodeError = error;
            },
        });
        audio.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
        const data = new AudioData({
            format: 'f32-planar',
            sampleRate: 48000,
            numberOfChannels: 2,
            numberOfFrames: 4800,
            timestamp: 0,
            data: new Float32Array(9600),
        });
        audio.encode(data);
        data.close();
        await audio.flush();
        audio.close();
        if (encodeError) throw encodeError;
        if (!videoChunks || !audioChunks) throw Error('Actual WebCodecs encode produced no output');
        const miss = await fetch('/assets/does-not-exist.js');
        if (miss.status !== 404) throw Error('Missing asset did not return 404');
        return {
            secure: isSecureContext,
            opfs: true,
            locks: true,
            gpu: adapter.info.description,
            ortModule: true,
            codecs,
            videoChunks,
            audioChunks,
        };
    });
    for (const route of ['/analyzer', '/editor', '/visualizer', '/']) {
        await current.page.goto(`app://audiosurf${route}`);
        await current.page.waitForSelector('#main-layout');
    }
    const isolated = await current.page.evaluate(
        () =>
            new Promise((resolve, reject) => {
                const iframe = document.createElement('iframe');
                iframe.setAttribute('sandbox', 'allow-scripts');
                const timer = setTimeout(() => {
                    iframe.remove();
                    reject(Error('Isolated worker timed out'));
                }, 15_000);
                function receive(event) {
                    if (event.source !== iframe.contentWindow || event.data?.kind !== 'desktop-isolation-smoke') return;
                    clearTimeout(timer);
                    window.removeEventListener('message', receive);
                    iframe.remove();
                    resolve({ ...event.data, origin: event.origin });
                }
                window.addEventListener('message', receive);
                iframe.srcdoc = `<script>const w=new Worker(URL.createObjectURL(new Blob([
            "postMessage({node:typeof require,process:typeof process})"
        ],{type:'text/javascript'})));w.onmessage=e=>{parent.postMessage({kind:'desktop-isolation-smoke',...e.data,bridge:typeof audiosurfDesktop},'*');w.terminate();};<\/script>`;
                document.body.appendChild(iframe);
            }),
    );
    assert.equal(isolated.origin, 'null');
    assert.equal(isolated.node, 'undefined');
    assert.equal(isolated.process, 'undefined');
    assert.equal(isolated.bridge, 'undefined');
    await current.app.close();
    current = undefined;
    current = await launch();
    const restored = await current.page.evaluate(async () => {
        const directory = await navigator.storage.getDirectory();
        return (await (await directory.getFileHandle('desktop-smoke-marker')).getFile()).text();
    });
    assert.equal(restored, 'persisted-desktop-smoke');
    assert.deepEqual(errors, []);
    const result = {
        security,
        capability,
        isolated,
        persistentRestart: true,
        limitations: [
            'Not FT inference evidence',
            'Not muxed WebM or media quality evidence',
            'Not native picker/install evidence',
        ],
    };
    await fs.writeFile(path.join(artifacts, 'smoke-result.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(result, null, 2));
} finally {
    await current?.app.close();
}
