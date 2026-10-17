import { spawnSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { measureOutputSynchronization } from '../support/visualizer-media-alignment.mjs';

// Functional output checks, separate from historical V5/V6 canonical evidence.
const root = path.resolve('artifacts/visualizer-composition/output');
const runId = process.argv[2] ?? 'current';
const allowFrameDrops = process.argv.includes('--allow-frame-drops');
if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw Error('Use an alphanumeric run ID.');
const run = (command, args, binary = false) => {
    const result = spawnSync(command, args, { encoding: binary ? null : 'utf8', maxBuffer: 128 * 1024 * 1024 });
    if (result.status !== 0) throw Error(`${command}: ${result.stderr || result.error?.message}`);
    return result.stdout;
};
const json = (command, args) => JSON.parse(run(command, ['-v', 'error', ...args, '-of', 'json']));
const end = packets => Math.max(...packets.map(p => Number(p.pts_time) + Number(p.duration_time ?? 0)));

function audioSignal(file) {
    const pcm = run('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-f', 'f32le', 'pipe:1'], true);
    let total = 0, peakRms = 0, peakTime = 0;
    const windows = [];
    const count = pcm.length / 4;
    for (let offset = 0; offset < count; offset += 480) {
        const stop = Math.min(offset + 480, count); let sum = 0;
        for (let i = offset; i < stop; i++) { const sample = pcm.readFloatLE(i * 4); sum += sample * sample; }
        total += sum;
        const rms = Math.sqrt(sum / (stop - offset));
        windows.push({ rms, time: (offset + (stop - offset) / 2) / 48000 });
        if (rms > peakRms) { peakRms = rms; peakTime = (offset + (stop - offset) / 2) / 48000; }
    }
    return { rms: Math.sqrt(total / count), peakRms, peakTime, windows };
}
function flashTimes(file) {
    const frames = json('ffprobe', ['-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time', file]).frames;
    const pixels = run('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v:0', '-vf', 'crop=64:64:(iw-64)/2:(ih-64)/2,scale=1:1,format=gray', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'], true);
    const times = [];
    for (let i = 0; i < pixels.length; i++) {
        if (pixels[i] >= 128 && (i === 0 || pixels[i - 1] < 128) && frames[i]) times.push(Number(frames[i].best_effort_timestamp_time));
    }
    if (!times.length) throw Error('No decoded synchronization flash.');
    return times;
}

const entries = (await readdir(root)).filter(name => name.startsWith(`${runId}-`) && name.endsWith('.webm.capture.json')).sort();
if (entries.length === 0 || process.argv.includes('--all') && entries.length !== 16) throw Error(`Incomplete matrix: ${entries.length} recordings.`);
const results = [];
for (const entry of entries) {
    const capture = JSON.parse(await readFile(path.join(root, entry), 'utf8'));
    const file = path.join(root, entry.replace(/\.capture\.json$/, ''));
    const result = { file: path.basename(file), browser: capture.browser, browserVersion: capture.browserVersion,
        resolution: capture.preset.resolution, targetFps: capture.preset.frameRate, kind: capture.kind, failures: [], frameDropWarnings: [] };
    const check = (condition, message) => { if (!condition) result.failures.push(message); };
    const checkCadence = (condition, message) => {
        if (!condition) { result.frameDropWarnings.push(message); if (!allowFrameDrops) result.failures.push(message); }
    };
    try {
        const probe = json('ffprobe', ['-show_streams', '-show_packets', '-show_format', file]);
        const video = probe.streams.filter(s => s.codec_type === 'video'), audio = probe.streams.filter(s => s.codec_type === 'audio');
        check(String(probe.format.format_name).split(',').some(name => ['webm', 'matroska'].includes(name)), 'WebM/Matroska container required.');
        check(video.length === 1 && audio.length === 1, 'Exactly one video and audio stream required.');
        check(['vp8', 'vp9'].includes(video[0].codec_name) && audio[0].codec_name === 'opus', 'VP8/VP9 + Opus required.');
        check(video[0].width === capture.preset.width && video[0].height === capture.preset.height, 'Dimensions differ from requested output.');
        const vp = probe.packets.filter(p => p.stream_index === video[0].index), ap = probe.packets.filter(p => p.stream_index === audio[0].index);
        for (const packets of [vp, ap]) check(packets.every((p, i) => i === 0 || Number(p.pts_time) > Number(packets[i - 1].pts_time)), 'Packet PTS must increase strictly.');
        const fps = (vp.length - 1) / (Number(vp.at(-1).pts_time) - Number(vp[0].pts_time));
        const maxGap = Math.max(...vp.slice(1).map((p, i) => Number(p.pts_time) - Number(vp[i].pts_time)));
        const videoEnd = end(vp), audioEnd = end(ap), duration = Number(probe.format.duration ?? Math.max(videoEnd, audioEnd) - Number(probe.format.start_time ?? 0));
        check(vp.length >= capture.preset.frameRate * 2, 'Insufficient video packets.');
        check(Number.isFinite(fps) && fps > 0, 'Packet FPS must be finite and positive.');
        checkCadence(Math.abs(fps - capture.preset.frameRate) <= capture.preset.frameRate * .05, 'Packet FPS outside ±5%.');
        checkCadence(maxGap <= 4 / capture.preset.frameRate + .001, 'Video packet gap over four target intervals.');
        check([videoEnd, audioEnd, duration].every(v => Math.abs(v - capture.sourceDurationSeconds) <= .25), 'Duration differs by over 250ms.');
        check(Math.abs(videoEnd - audioEnd) <= .1, 'A/V end delta over 100ms.');
        const signal = audioSignal(file);
        check(signal.rms >= .001 && signal.peakRms >= .005, 'Pre-Gain recording is silent at page volume zero.');
        Object.assign(result, { codec: video[0].codec_name, width: video[0].width, height: video[0].height, fps, maxGap, videoEnd, audioEnd, duration, audioRms: signal.rms });
        if (capture.kind === 'sync') {
            const flashes = flashTimes(file), expected = capture.syncEventsSeconds ?? [1.5];
            const { syncEvents, syncDriftSeconds, failures } = measureOutputSynchronization(expected, flashes, signal.windows, capture.syncFlashSeconds ?? 0);
            result.failures.push(...failures);
            Object.assign(result, { syncEvents, syncDriftSeconds });
        }
        run('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-map', '0:v:0', '-map', '0:a:0', '-fps_mode', 'passthrough', '-enc_time_base:v', '-1', '-f', 'null', '-']);
    } catch (error) { result.failures.push(error.message); }
    results.push(result);
}
const profiles = [...new Set(results.map(r => `${r.resolution}${r.targetFps}`))].map(id => {
    const rows = results.filter(r => `${r.resolution}${r.targetFps}` === id);
    const complete = ['chrome', 'edge'].every(browser => ['sync', 'music'].every(kind => rows.some(r => r.browser === browser && r.kind === kind)));
    return { id, complete, passed: complete && rows.every(r => r.failures.length === 0), frameDropWarning: rows.some(r => r.frameDropWarnings.length > 0) };
});
const policy = allowFrameDrops ? 'alignment-with-frame-drop-warning' : 'strict';
await writeFile(path.join(root, `${runId}-${policy}-measurement.json`), JSON.stringify({ runId, policy, results, profiles }, null, 2) + '\n');
for (const row of results) console.log(`${row.browser} ${row.resolution}${row.targetFps} ${row.kind}: ${row.fps?.toFixed(2)} fps, gap ${row.maxGap?.toFixed(3)}s, ${row.failures.length ? row.failures.join(' ') : 'PASS'}${row.frameDropWarnings.length ? ' [frame-drop warning]' : ''}`);
console.log(JSON.stringify(profiles));
if (profiles.some(p => !p.passed)) process.exitCode = 1;
