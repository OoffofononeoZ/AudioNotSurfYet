import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const artifactRoot = path.resolve(
    process.env.VISUALIZER_V6_ARTIFACT_DIR
        ?? path.join(repositoryRoot, 'artifacts/evals/V6-latest-media'),
);
const supportedVideoCodecs = new Set(['vp8', 'vp9']);
const durationLimitSeconds = 0.25;
const endDeltaLimitSeconds = 0.1;
const targetFrameRate = 30;

const run = (command, args, binary = false) => {
    const result = spawnSync(command, args, {
        cwd: repositoryRoot,
        encoding: binary ? null : 'utf8',
        maxBuffer: 128 * 1024 * 1024,
    });
    if (result.status !== 0) {
        const stderr = Buffer.isBuffer(result.stderr)
            ? result.stderr.toString('utf8')
            : result.stderr;
        throw new Error(`${command} failed (${result.status}): ${stderr || result.error?.message}`);
    }
    return result.stdout;
};

const finiteNumber = (value) => {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
};

const parseFraction = (value) => {
    if (typeof value !== 'string') return finiteNumber(value);
    const [numerator, denominator = '1'] = value.split('/').map(Number);
    return denominator === 0 ? null : numerator / denominator;
};

const packetEnd = (packets) => Math.max(...packets.map((packet) =>
    (finiteNumber(packet.pts_time) ?? 0) + (finiteNumber(packet.duration_time) ?? 0)));

const inspectAudioPeakRms = (file) => {
    const pcm = run('ffmpeg', [
        '-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '48000',
        '-f', 'f32le', 'pipe:1',
    ], true);
    let sumSquares = 0;
    let peak = 0;
    for (let offset = 0; offset + 4 <= pcm.byteLength; offset += 4) {
        const sample = pcm.readFloatLE(offset);
        sumSquares += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
    }
    const sampleCount = Math.floor(pcm.byteLength / 4);
    return {
        sampleCount,
        rms: Math.sqrt(sumSquares / Math.max(1, sampleCount)),
        peak,
    };
};

const inspectFile = async (browser, entry) => {
    const file = path.resolve(entry.file);
    await access(file);
    const probe = JSON.parse(run('ffprobe', [
        '-v', 'error',
        '-show_format',
        '-show_streams',
        '-show_packets',
        '-show_entries', [
            'format=format_name,duration,start_time',
            'stream=index,codec_type,codec_name,width,height,avg_frame_rate,duration,start_time',
            'packet=stream_index,pts_time,dts_time,duration_time,size,flags',
        ].join(':'),
        '-of', 'json',
        file,
    ]));
    await writeFile(`${file}.ffprobe.json`, `${JSON.stringify(probe, null, 2)}\n`, 'utf8');
    const videoStreams = probe.streams?.filter((stream) => stream.codec_type === 'video') ?? [];
    const audioStreams = probe.streams?.filter((stream) => stream.codec_type === 'audio') ?? [];
    if (videoStreams.length !== 1 || audioStreams.length !== 1) {
        throw new Error(`${path.basename(file)} must contain one video and one audio stream.`);
    }
    const [video] = videoStreams;
    const [audio] = audioStreams;
    if (!supportedVideoCodecs.has(video.codec_name) || audio.codec_name !== 'opus') {
        throw new Error(`${path.basename(file)} must use VP9/VP8 plus Opus.`);
    }
    if (video.width !== 1280 || video.height !== 720) {
        throw new Error(`${path.basename(file)} is not exactly 1280x720.`);
    }
    if (!String(probe.format?.format_name).split(',').some((name) =>
        ['webm', 'matroska'].includes(name))) {
        throw new Error(`${path.basename(file)} is not WebM/Matroska.`);
    }
    const packets = probe.packets ?? [];
    const videoPackets = packets.filter((packet) => packet.stream_index === video.index)
        .sort((left, right) => Number(left.pts_time) - Number(right.pts_time));
    const audioPackets = packets.filter((packet) => packet.stream_index === audio.index)
        .sort((left, right) => Number(left.pts_time) - Number(right.pts_time));
    if (videoPackets.length < targetFrameRate * 2 || audioPackets.length === 0) {
        throw new Error(`${path.basename(file)} has insufficient A/V packets.`);
    }
    const firstVideo = Number(videoPackets[0].pts_time);
    const lastVideo = Number(videoPackets.at(-1).pts_time);
    const packetFrameRate = (videoPackets.length - 1) / (lastVideo - firstVideo);
    const metadataFrameRate = parseFraction(video.avg_frame_rate);
    const frameRate = metadataFrameRate && metadataFrameRate > 0
        ? metadataFrameRate
        : packetFrameRate;
    if (Math.abs(frameRate - targetFrameRate) > targetFrameRate * 0.05) {
        throw new Error(`${path.basename(file)} frame rate ${frameRate} misses 30fps ±5%.`);
    }
    let maximumVideoPacketGapSeconds = 0;
    for (let index = 1; index < videoPackets.length; index += 1) {
        maximumVideoPacketGapSeconds = Math.max(
            maximumVideoPacketGapSeconds,
            Number(videoPackets[index].pts_time) - Number(videoPackets[index - 1].pts_time),
        );
    }
    if (maximumVideoPacketGapSeconds > (2 / targetFrameRate) + 0.001) {
        throw new Error(
            `${browser}/${entry.format} ${path.basename(file)} has a ${maximumVideoPacketGapSeconds}s video packet gap over two frame intervals.`,
        );
    }
    const videoEndSeconds = packetEnd(videoPackets);
    const audioEndSeconds = packetEnd(audioPackets);
    const containerMetadataSeconds = finiteNumber(probe.format?.duration);
    const containerStartSeconds = finiteNumber(probe.format?.start_time) ?? 0;
    const containerDurationSeconds = containerMetadataSeconds
        ?? Math.max(videoEndSeconds, audioEndSeconds) - containerStartSeconds;
    const sourceDurationSeconds = Number(entry.sourceDurationSeconds);
    for (const [name, duration] of [
        ['container', containerDurationSeconds],
        ['video', videoEndSeconds],
        ['audio', audioEndSeconds],
    ]) {
        if (Math.abs(duration - sourceDurationSeconds) > durationLimitSeconds) {
            throw new Error(`${path.basename(file)} ${name} duration ${duration} misses source ${sourceDurationSeconds}.`);
        }
    }
    const audioVideoEndDeltaSeconds = Math.abs(videoEndSeconds - audioEndSeconds);
    if (audioVideoEndDeltaSeconds > endDeltaLimitSeconds) {
        throw new Error(`${path.basename(file)} A/V end delta exceeds 100ms.`);
    }
    const audioSignal = inspectAudioPeakRms(file);
    if (audioSignal.rms < 0.001 || audioSignal.peak < 0.005) {
        throw new Error(`${path.basename(file)} is unexpectedly silent.`);
    }
    const bytes = await readFile(file);
    return {
        browser,
        format: entry.format,
        template: entry.template,
        file: path.relative(repositoryRoot, file),
        byteLength: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        codecs: { video: video.codec_name, audio: audio.codec_name },
        dimensions: { width: video.width, height: video.height },
        targetFrameRate,
        averageFrameRate: frameRate,
        maximumVideoPacketGapSeconds,
        sourceDurationSeconds,
        containerDurationSeconds,
        videoEndSeconds,
        audioEndSeconds,
        audioVideoEndDeltaSeconds,
        audioSignal,
    };
};

const files = [];
const browserReports = [];
for (const browser of ['chrome', 'edge']) {
    const matrixPath = path.join(artifactRoot, browser, 'v6-capability-matrix.json');
    const report = JSON.parse(await readFile(matrixPath, 'utf8'));
    if (report.browser !== browser || !Array.isArray(report.matrix)) {
        throw new Error(`${matrixPath} is not a V6 capability matrix.`);
    }
    for (const format of ['mp3', 'wav', 'flac']) {
        const entry = report.matrix.find((candidate) => candidate.format === format);
        if (entry?.status !== 'saved' || entry.preset !== '720p30') {
            throw new Error(`${browser} ${format} must have one saved default 720p30 result.`);
        }
        files.push(await inspectFile(browser, entry));
    }
    browserReports.push(report);
}
if (files.length < 6) throw new Error(`V6 media requires six files; received ${files.length}.`);

await mkdir(artifactRoot, { recursive: true });
const result = {
    schemaVersion: 1,
    result: 'pass',
    thresholds: {
        frameRatePercent: 5,
        maximumVideoPacketIntervals: 2,
        durationDeltaSeconds: durationLimitSeconds,
        audioVideoEndDeltaSeconds: endDeltaLimitSeconds,
    },
    browserReports,
    files,
};
await writeFile(
    path.join(artifactRoot, 'v6-media-report.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
);
console.log(JSON.stringify({
    metric: 'v6-media-verification',
    result: result.result,
    artifactRoot: path.relative(repositoryRoot, artifactRoot),
    files,
}));
