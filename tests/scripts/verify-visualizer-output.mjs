import { spawnSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { measureOutputSynchronization } from '../support/visualizer-media-alignment.mjs';
import { measureAudioPcm, parseAudioTimeline } from '../support/visualizer-audio-timeline.mjs';
import { measureOfflineVideoTimeline } from '../support/visualizer-video-timeline.mjs';

// Functional output checks, separate from historical V5/V6 canonical evidence.
const root = path.resolve('artifacts/visualizer-composition/output');
const runId = process.argv[2] ?? 'current';
const allowFrameDrops = process.argv.includes('--allow-frame-drops');
const filesOnly = process.argv.includes('--files-only');
if (filesOnly && process.argv.includes('--all')) throw Error('Choose --files-only or --all.');
const measurementVersion = 'offline-sync-v4';
if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw Error('Use an alphanumeric run ID.');
const run = (command, args, binary = false) => {
    const result = spawnSync(command, args, { encoding: binary ? null : 'utf8', maxBuffer: 128 * 1024 * 1024 });
    if (result.status !== 0) throw Error(`${command}: ${result.stderr || result.error?.message}`);
    return result.stdout;
};
const json = (command, args) => JSON.parse(run(command, ['-v', 'error', ...args, '-of', 'json']));
const end = packets => Math.max(...packets.map(p => Number(p.pts_time) + Number(p.duration_time ?? 0)));

function audioSignal(file) {
    const decoded = spawnSync(
        'ffmpeg',
        [
            '-v',
            'info',
            '-nostats',
            '-i',
            file,
            '-map',
            '0:a:0',
            '-af',
            'aformat=sample_fmts=flt:sample_rates=48000:channel_layouts=mono,ashowinfo',
            '-f',
            'f32le',
            'pipe:1',
        ],
        { maxBuffer: 256 * 1024 * 1024 },
    );
    if (decoded.status !== 0) throw Error(`Audio decode failed: ${decoded.stderr || decoded.error?.message}`);
    return measureAudioPcm(decoded.stdout, parseAudioTimeline(decoded.stderr.toString('utf8')));
}
function flashTimes(file, times) {
    const pixels = run(
        'ffmpeg',
        [
            '-v',
            'error',
            '-i',
            file,
            '-map',
            '0:v:0',
            '-vf',
            'crop=64:64:(iw-64)/2:(ih-64)/2,scale=1:1,format=gray',
            '-fps_mode',
            'passthrough',
            '-f',
            'rawvideo',
            '-pix_fmt',
            'gray',
            'pipe:1',
        ],
        true,
    );
    const flashes = [];
    for (let i = 0; i < pixels.length; i++) {
        if (pixels[i] >= 128 && (i === 0 || pixels[i - 1] < 128)) flashes.push(times[i]);
    }
    if (pixels.length !== times.length) throw Error('Decoded video pixels and timestamps differ.');
    if (!flashes.length) throw Error('No decoded synchronization flash.');
    return flashes;
}

const entries = (await readdir(root))
    .filter(name => name.startsWith(`${runId}-`) && name.endsWith('.webm.capture.json'))
    .sort();
if (entries.length === 0) throw Error('No output artifacts.');
const results = [];
for (const entry of entries) {
    const capture = JSON.parse(await readFile(path.join(root, entry), 'utf8'));
    const audioVideoOffsetSeconds = (capture.audioVideoOffsetMs ?? 0) / 1000;
    const outputDurationSeconds = capture.sourceDurationSeconds + Math.abs(audioVideoOffsetSeconds);
    if (capture.mode === 'offline' && allowFrameDrops) throw Error('Offline export requires strict frame checks.');
    const file = path.join(root, entry.replace(/\.capture\.json$/, ''));
    const result = {
        file: path.basename(file),
        browser: capture.browser,
        browserVersion: capture.browserVersion,
        resolution: capture.preset.resolution,
        targetFps: capture.preset.frameRate,
        kind: capture.kind,
        mode: capture.mode ?? 'realtime',
        scenario: capture.scenario ?? null,
        audioVideoOffsetMs: capture.audioVideoOffsetMs ?? 0,
        failures: [],
        frameDropWarnings: [],
    };
    const check = (condition, message) => {
        if (!condition) result.failures.push(message);
    };
    const checkCadence = (condition, message) => {
        if (!condition) {
            result.frameDropWarnings.push(message);
            if (!allowFrameDrops) result.failures.push(message);
        }
    };
    try {
        const probe = json('ffprobe', ['-show_streams', '-show_packets', '-show_format', file]);
        const video = probe.streams.filter(s => s.codec_type === 'video'),
            audio = probe.streams.filter(s => s.codec_type === 'audio');
        check(
            String(probe.format.format_name)
                .split(',')
                .some(name => ['webm', 'matroska'].includes(name)),
            'WebM/Matroska container required.',
        );
        check(video.length === 1 && audio.length === 1, 'Exactly one video and audio stream required.');
        check(
            ['vp8', 'vp9'].includes(video[0].codec_name) && audio[0].codec_name === 'opus',
            'VP8/VP9 + Opus required.',
        );
        check(
            video[0].width === capture.preset.width && video[0].height === capture.preset.height,
            'Dimensions differ from requested output.',
        );
        const vp = probe.packets.filter(p => p.stream_index === video[0].index),
            ap = probe.packets.filter(p => p.stream_index === audio[0].index);
        for (const packets of [vp, ap])
            check(
                packets.every((p, i) => i === 0 || Number(p.pts_time) > Number(packets[i - 1].pts_time)),
                'Packet PTS must increase strictly.',
            );
        const fps = (vp.length - 1) / (Number(vp.at(-1).pts_time) - Number(vp[0].pts_time));
        const maxGap = Math.max(...vp.slice(1).map((p, i) => Number(p.pts_time) - Number(vp[i].pts_time)));
        const videoEnd = end(vp),
            audioEnd = end(ap),
            duration = Number(
                probe.format.duration ?? Math.max(videoEnd, audioEnd) - Number(probe.format.start_time ?? 0),
            );
        check(vp.length >= capture.preset.frameRate * 2, 'Insufficient video packets.');
        check(Number.isFinite(fps) && fps > 0, 'Packet FPS must be finite and positive.');
        checkCadence(
            Math.abs(fps - capture.preset.frameRate) <= capture.preset.frameRate * 0.05,
            'Packet FPS outside ±5%.',
        );
        checkCadence(maxGap <= 4 / capture.preset.frameRate + 0.001, 'Video packet gap over four target intervals.');
        check(
            [videoEnd, audioEnd, duration].every(v => Math.abs(v - outputDurationSeconds) <= 0.25),
            'Duration differs by over 250ms.',
        );
        check(Math.abs(videoEnd - audioEnd) <= 0.1, 'A/V end delta over 100ms.');
        const signal = audioSignal(file);
        const times = json('ffprobe', [
            '-select_streams',
            'v:0',
            '-show_frames',
            '-show_entries',
            'frame=best_effort_timestamp_time',
            file,
        ]).frames.map(f => Number(f.best_effort_timestamp_time));
        if (capture.mode === 'offline') {
            const timeline = measureOfflineVideoTimeline(times, outputDurationSeconds, capture.preset.frameRate);
            result.failures.push(...timeline.failures);
            Object.assign(result, { expectedFrames: timeline.expectedFrames, decodedFrames: timeline.decodedFrames });
        }
        check(signal.rms >= 0.001 && signal.peakRms >= 0.005, 'Pre-Gain recording is silent at page volume zero.');
        Object.assign(result, {
            codec: video[0].codec_name,
            width: video[0].width,
            height: video[0].height,
            fps,
            maxGap,
            videoEnd,
            audioEnd,
            duration,
            audioRms: signal.rms,
        });
        if (capture.kind === 'sync') {
            const flashes = flashTimes(file, times),
                expected = capture.syncEventsSeconds ?? [1.5];
            const { syncEvents, syncDriftSeconds, failures } = measureOutputSynchronization(
                expected,
                flashes,
                signal.windows,
                capture.syncFlashSeconds ?? 0,
                audioVideoOffsetSeconds,
            );
            result.failures.push(...failures);
            Object.assign(result, { syncEvents, syncDriftSeconds });
        }
        run('ffmpeg', [
            '-v',
            'error',
            '-xerror',
            '-i',
            file,
            '-map',
            '0:v:0',
            '-map',
            '0:a:0',
            '-fps_mode',
            'passthrough',
            '-enc_time_base:v',
            '-1',
            '-f',
            'null',
            '-',
        ]);
    } catch (error) {
        result.failures.push(error.message);
    }
    results.push(result);
}
const profiles = [...new Set(results.map(r => `${r.resolution}${r.targetFps}`))].map(id => {
    const rows = results.filter(r => `${r.resolution}${r.targetFps}` === id);
    const complete =
        ['chrome', 'edge'].every(browser =>
            ['sync', 'music'].every(kind => rows.some(r => r.browser === browser && r.kind === kind)),
        ) &&
        (rows[0].mode !== 'offline' ||
            ['chrome', 'edge'].every(browser =>
                ['cold', 'repeat', 'music'].every(scenario =>
                    rows.some(r => r.browser === browser && r.scenario === scenario),
                ),
            ));
    return {
        id,
        complete,
        passed: complete && rows.every(r => r.failures.length === 0),
        frameDropWarning: rows.some(r => r.frameDropWarnings.length > 0),
    };
});
const policy = allowFrameDrops ? 'alignment-with-frame-drop-warning' : 'strict';
if (process.argv.includes('--all') && (profiles.length !== 4 || profiles.some(p => !p.complete)))
    throw Error(`Incomplete matrix: ${entries.length} artifacts.`);
await writeFile(
    path.join(root, `${runId}-${policy}-${measurementVersion}-measurement.json`),
    JSON.stringify({ runId, policy, measurementVersion, results, profiles }, null, 2) + '\n',
);
for (const row of results)
    console.log(
        `${row.browser} ${row.resolution}${row.targetFps} ${row.kind}: ${row.fps?.toFixed(2)} fps, gap ${row.maxGap?.toFixed(3)}s, ${row.failures.length ? row.failures.join(' ') : 'PASS'}${row.frameDropWarnings.length ? ' [frame-drop warning]' : ''}`,
    );
console.log(JSON.stringify(profiles));
if (filesOnly ? results.some(r => r.failures.length) : profiles.some(p => !p.passed)) process.exitCode = 1;
