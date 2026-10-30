import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { _electron } from '@playwright/test';
import { createNativeRun, copyNativeTree, cleanupNativeTree } from '../../scripts/lib/desktop-native-runtime.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(root, 'artifacts/desktop');
const appRoot = path.join(artifacts, 'app');
const packaged = process.argv.includes('--packaged');
const mode = packaged ? 'packaged' : 'application';
const native = await createNativeRun(`smoke-${mode}`);
const profile = native.profile;
const source = packaged
    ? path.join(artifacts, 'packages/win-unpacked')
    : path.dirname(createRequire(import.meta.url)('electron'));
const runtime = await copyNativeTree(source, path.join(native.directory, 'runtime'));
const run = path.join(artifacts, 'capabilities', path.basename(native.directory));
await fs.mkdir(run, { recursive: true });
await fs.writeFile(path.join(run, 'runtime-copy.json'), JSON.stringify(runtime, null, 4) + '\n', 'utf8');
console.log(`Electron ${mode} smoke: ${run}`);
const env = {
    ...process.env,
    AUDIOSURF_DESKTOP_TEST_PROFILE: profile,
    TEMP: native.temp,
    TMP: native.temp,
};
delete env.ELECTRON_RUN_AS_NODE;
const errors = [];
// Project-generated ONNX IR 8 / opset 13: float32[4] x + y -> sum.
// Arithmetic only, no external weights or user/model artifacts.
const ortAddModel = Array.from(
    Buffer.from(
        'CAgSKEF1ZGlvTm90U3VyZllldCBkZXNrdG9wIGFyaXRobWV0aWMgcHJvYmU6WQoVCgF4CgF5EgNzdW0aA3N1bSIDQWRkEgtkZXNrdG9wLWFkZFoPCgF4EgoKCAgBEgQKAggEWg8KAXkSCgoICAESBAoCCARiEQoDc3VtEgoKCAgBEgQKAggEQgQKABAN',
        'base64',
    ),
);

async function launch() {
    const app = await _electron.launch({
        executablePath: path.join(runtime.root, packaged ? 'AudioNotSurfYet.exe' : 'electron.exe'),
        args: [`--user-data-dir=${profile}`, ...(!packaged ? [appRoot] : [])],
        cwd: root,
        env,
        timeout: 60_000,
    });
    current = { app };
    const page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#main-layout', { timeout: 60_000 });
    return { app, page };
}

let current;
let result;
let failure;
try {
    current = await launch();
    const security = await current.app.evaluate(async ({ BrowserWindow, app }) => {
        const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
        return {
            sandbox: preferences.sandbox,
            isolation: preferences.contextIsolation,
            node: preferences.nodeIntegration,
            workerNode: preferences.nodeIntegrationInWorker,
            platform: process.platform,
            arch: process.arch,
            systemVersion: process.getSystemVersion(),
            gpuInfo: await app.getGPUInfo('basic'),
            versions: process.versions,
        };
    });
    assert.equal(security.sandbox, true);
    assert.equal(security.isolation, true);
    assert.equal(security.node, false);
    assert.equal(security.workerNode, false);
    result = { security };
    const capability = await current.page.evaluate(async model => {
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
        if (!document.createElement('canvas').getContext('webgl2')) throw Error('WebGL2 unavailable');
        const ort = await import('/processing-runtime/ort.all.min.mjs');
        if (typeof ort.InferenceSession.create !== 'function') throw Error('Pinned ORT module missing');
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.proxy = false;
        ort.env.wasm.wasmPaths = '/processing-runtime/';
        ort.env.webgpu.adapter = adapter;
        let session;
        const x = new ort.Tensor('float32', Float32Array.of(1, 2, 3, 4), [4]);
        const y = new ort.Tensor('float32', Float32Array.of(2, 3, 4, 5), [4]);
        let outputs;
        let ortSum;
        try {
            session = await ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['webgpu'] });
            outputs = await session.run({ x, y });
            ortSum = Array.from(outputs.sum.data);
            if (JSON.stringify(ortSum) !== '[3,5,7,9]') throw Error('ORT WebGPU arithmetic mismatch');
        } finally {
            x.dispose();
            y.dispose();
            if (outputs) for (const tensor of Object.values(outputs)) tensor.dispose();
            await session?.release();
        }
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
        const videoByCodec = [];
        let audioChunks = 0;
        let encodeError;
        const canvas = new OffscreenCanvas(64, 64);
        canvas.getContext('2d').fillRect(0, 0, 64, 64);
        for (const codec of codecs) {
            const timestamps = [];
            let bytes = 0;
            const video = new VideoEncoder({
                output: chunk => {
                    timestamps.push(chunk.timestamp);
                    bytes += chunk.byteLength;
                },
                error: error => {
                    encodeError = error;
                },
            });
            try {
                video.configure({ codec, width: 64, height: 64, bitrate: 100_000, framerate: 30 });
                for (let index = 0; index < 3; index++) {
                    const frame = new VideoFrame(canvas, {
                        timestamp: Math.round((index * 1e6) / 30),
                        duration: 33333,
                    });
                    try {
                        video.encode(frame);
                    } finally {
                        frame.close();
                    }
                }
                await video.flush();
            } finally {
                if (video.state !== 'closed') video.close();
            }
            if (JSON.stringify(timestamps) !== '[0,33333,66667]' || bytes === 0)
                throw Error(`Actual ${codec} encode output mismatch`);
            videoByCodec.push({ codec, timestamps, bytes });
        }
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
        if (!audioChunks) throw Error('Actual Opus encode produced no output');
        const miss = await fetch('/assets/does-not-exist.js');
        if (miss.status !== 404) throw Error('Missing asset did not return 404');
        return {
            secure: isSecureContext,
            opfs: true,
            locks: true,
            gpu: {
                vendor: adapter.info.vendor,
                architecture: adapter.info.architecture,
                device: adapter.info.device,
                description: adapter.info.description,
                isFallbackAdapter: adapter.info.isFallbackAdapter,
            },
            ortWebgpuSum: ortSum,
            codecs,
            videoByCodec,
            audioChunks,
        };
    }, ortAddModel);
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
            "(async()=>{const u=URL.createObjectURL(new Blob(['export const value=7'],{type:'text/javascript'}));try{const module=await import(u);postMessage({node:typeof require,process:typeof process,moduleValue:module.value})}catch(error){postMessage({error:error.message})}finally{URL.revokeObjectURL(u)}})()"
        ],{type:'text/javascript'})));w.onmessage=e=>{parent.postMessage({kind:'desktop-isolation-smoke',...e.data,bridge:typeof audiosurfDesktop},'*');w.terminate();};<\/script>`;
                document.body.appendChild(iframe);
            }),
    );
    result.isolated = isolated;
    assert.equal(isolated.error, undefined);
    assert.equal(isolated.origin, 'null');
    assert.equal(isolated.node, 'undefined');
    assert.equal(isolated.process, 'undefined');
    assert.equal(isolated.bridge, 'undefined');
    assert.equal(isolated.moduleValue, 7);
    await current.app.close();
    current = undefined;
    current = await launch();
    const restored = await current.page.evaluate(async () => {
        const directory = await navigator.storage.getDirectory();
        return (await (await directory.getFileHandle('desktop-smoke-marker')).getFile()).text();
    });
    assert.equal(restored, 'persisted-desktop-smoke');
    assert.deepEqual(errors, []);
    await current.page.screenshot({ path: path.join(run, 'application.png') });
    result = {
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
} catch (error) {
    failure = error;
} finally {
    try {
        await current?.app.close();
        if (!failure) await cleanupNativeTree(runtime);
    } catch (error) {
        failure ??= error;
    }
    const summary = {
        mode,
        nativeDirectory: native.directory,
        ...(result ?? {}),
        status: failure ? 'failed' : 'passed',
        ...(failure ? { error: String(failure) } : {}),
    };
    await fs.writeFile(path.join(run, 'result.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(summary, null, 2));
}
if (failure) throw failure;
