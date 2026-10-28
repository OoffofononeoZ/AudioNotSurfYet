import { chromium } from '@playwright/test';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.ANALYSIS_BENCHMARK_URL ?? 'http://127.0.0.1:5173';
const baseline = process.argv[2] ?? '5e7ae40d55080e609cc1d379caa69c19196010b1';
const sources = new Map();
function oldModule(name) {
    if (sources.has(name)) return sources.get(name);
    const source = execFileSync(
        'git',
        ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'show', `${baseline}:src/analysis/${name}`],
        { encoding: 'utf8' },
    );
    let code = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
    }).outputText;
    code = code.replace(/(from\s*|import\s*)(['"])([^'"]+)\2/g, (match, prefix, quote, spec) => {
        let url;
        if (spec.startsWith('./'))
            url = `${origin}/__analysis_before/${spec.slice(2)}${spec.endsWith('.ts') ? '' : '.ts'}`;
        else if (spec.startsWith('../'))
            url = new URL(`${spec}${spec.endsWith('.ts') ? '' : '.ts'}`, `${origin}/src/analysis/${name}`).href;
        else url = `${origin}/node_modules/.vite/deps/${spec}.js`;
        return `${prefix}${quote}${url}${quote}`;
    });
    sources.set(name, code);
    return code;
}
const report = { baseline, sampleRate: 48000, durationSeconds: 180, channels: 2, results: [] };
for (const channel of ['chrome', 'msedge']) {
    const browser = await chromium.launch({ channel, headless: true });
    try {
        const context = await browser.newContext();
        await context.route('**/__analysis_before/**', async route => {
            const name = new URL(route.request().url()).pathname.split('/').at(-1);
            await route.fulfill({ contentType: 'text/javascript', body: oldModule(name) });
        });
        await context.route('**/__analysis_perf_blank', route =>
            route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Analysis performance</title>' }),
        );
        const page = await context.newPage();
        await page.goto(origin + '/__analysis_perf_blank');
        const data = await page.evaluate(async () => {
            const versions = {
                before: await import('/__analysis_before/pcm.ts'),
                after: await import('/src/analysis/pcm.ts'),
            };
            const sampleRate = 48000,
                duration = 180,
                length = sampleRate * duration;
            const channels = [new Float32Array(length), new Float32Array(length)];
            for (let i = 0; i < length; i++) {
                channels[0][i] = 0.3 * Math.sin(i * 0.0576);
                channels[1][i] = 0.2 * Math.sin(i * 0.081);
            }
            const descriptor = {
                trackId: 'probe',
                revision: 1,
                sampleRate,
                length,
                channelCount: 2,
                durationSeconds: duration,
            };
            const engine = {
                getDecodedAudioDescriptor: () => descriptor,
                copyDecodedChannelRange: ({ channel, start, length }) => channels[channel].slice(start, start + length),
            };
            const records = [];
            for (let round = 0; round < 3; round++)
                for (const version of round % 2 ? ['after', 'before'] : ['before', 'after']) {
                    const modulePath = version === 'before' ? '/__analysis_before' : '/src/analysis';
                    const code = `
import { runAnalysisJob } from '${location.origin}${modulePath}/workerCore.ts';
import { createAnalysisConfig } from '${location.origin}${modulePath}/config.ts';
const config = await createAnalysisConfig(48000);
postMessage({ ready: true });
onmessage = async ({ data }) => {
    try {
        const start = performance.now();
        const { result } = await runAnalysisJob({
            kind: 'analyze', jobId: 'probe', generation: 1, trackHash: 'probe',
            config, featureIds: data.ids, cursorFeatureIds: data.ids,
            pcm: data.pcm, durationSeconds: 180,
        });
        const ms = performance.now() - start;
        const signatures = [];
        for (const series of result.series) {
            const parts = [];
            for (const [key, value] of Object.entries(series.payload)) {
                if (ArrayBuffer.isView(value)) {
                    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
                    const digest = await crypto.subtle.digest('SHA-256', bytes);
                    parts.push([key, Array.from(new Uint8Array(digest))]);
                } else parts.push([key, value]);
            }
            signatures.push([series.featureId, parts]);
        }
        postMessage({ ms, signatures });
    } catch (error) {
        postMessage({ error: String(error) });
    }
};`;
                    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' })),
                        worker = new Worker(url, { type: 'module' });
                    await new Promise((resolve, reject) => {
                        worker.onmessage = e => resolve(e.data);
                        worker.onerror = e => reject(new Error(e.message));
                    });
                    for (const ids of [['buffer'], ['buffer', 'amplitudeSpectrum', 'rms', 'mfcc']]) {
                        const start = performance.now(),
                            copied = await versions[version].copyDecodedAudioToMono(engine),
                            copyMs = performance.now() - start;
                        const result = await new Promise((resolve, reject) => {
                            worker.onmessage = e => resolve(e.data);
                            worker.onerror = e => reject(new Error(e.message));
                            worker.postMessage({ ids, pcm: copied.pcm.buffer }, [copied.pcm.buffer]);
                        });
                        records.push({ round, version, ids, copyMs, ...result });
                    }
                    worker.terminate();
                    URL.revokeObjectURL(url);
                }
            return records;
        });
        const signatures = new Map();
        for (const entry of data) {
            if (entry.error || !Array.isArray(entry.signatures))
                throw new Error(entry.error ?? 'Missing analysis payload signatures.');
            const key = entry.ids.join(',');
            const signature = JSON.stringify(
                entry.signatures?.map(([id, parts]) => [id, parts.sort(([a], [b]) => a.localeCompare(b))]),
            );
            if (!signatures.has(key)) signatures.set(key, signature);
            entry.identical = signatures.get(key) === signature;
            delete entry.signatures;
        }
        report.results.push({ channel, records: data });
        console.log(JSON.stringify({ channel, records: data }));
    } finally {
        await browser.close();
    }
}
await mkdir('artifacts/analysis-performance', { recursive: true });
await writeFile('artifacts/analysis-performance/comparison.json', JSON.stringify(report, null, 2), 'utf8');
if (report.results.some(result => result.records.some(record => !record.identical))) process.exitCode = 1;
