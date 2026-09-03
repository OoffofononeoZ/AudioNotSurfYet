import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const artifactRoot = path.resolve(
    process.env.VISUALIZER_V5_ARTIFACT_DIR
        ?? path.join(repositoryRoot, 'artifacts/evals/V5-latest-media'),
);
const fixtureDurationSeconds = 3;
const syncLimitSeconds = 0.1;
const durationLimitSeconds = 0.25;
const supportedVideoCodecs = new Set(['vp8', 'vp9']);

const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, {
        cwd: repositoryRoot,
        encoding: options.binary ? null : 'utf8',
        maxBuffer: 128 * 1024 * 1024,
    });
    if (result.status !== 0) {
        const detail = Buffer.isBuffer(result.stderr)
            ? result.stderr.toString('utf8')
            : result.stderr;
        throw new Error(`${command} failed (${result.status}): ${detail || result.error?.message}`);
    }
    return result.stdout;
};

const parseFraction = (value) => {
    if (typeof value !== 'string') return Number(value);
    const [numerator, denominator = '1'] = value.split('/').map(Number);
    return denominator === 0 ? Number.NaN : numerator / denominator;
};

const finiteNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const packetEnd = (packets) => Math.max(...packets.map((packet) => {
    const start = finiteNumber(packet.pts_time) ?? 0;
    return start + (finiteNumber(packet.duration_time) ?? 0);
}));

const inspectAudio = (file) => {
    const pcm = run('ffmpeg', [
        '-v', 'error',
        '-i', file,
        '-map', '0:a:0',
        '-ac', '1',
        '-ar', '48000',
        '-f', 'f32le',
        'pipe:1',
    ], { binary: true });
    const samplesPerWindow = 480;
    const sampleCount = Math.floor(pcm.byteLength / 4);
    const rms = [];
    for (let offset = 0; offset < sampleCount; offset += samplesPerWindow) {
        const end = Math.min(offset + samplesPerWindow, sampleCount);
        let sumSquares = 0;
        for (let index = offset; index < end; index += 1) {
            const sample = pcm.readFloatLE(index * 4);
            sumSquares += sample * sample;
        }
        rms.push(Math.sqrt(sumSquares / Math.max(1, end - offset)));
    }
    const peakRms = Math.max(...rms);
    const peakWindow = rms.indexOf(peakRms);
    return {
        peakRms,
        peakTimeSeconds: (peakWindow * samplesPerWindow + samplesPerWindow / 2) / 48_000,
        windowSeconds: samplesPerWindow / 48_000,
        sampleCount,
    };
};

const inspectCenterBrightness = (file) => {
    const frames = JSON.parse(run('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_frames',
        '-show_entries', 'frame=best_effort_timestamp_time,pkt_duration_time',
        '-of', 'json',
        file,
    ])).frames ?? [];
    const pixels = run('ffmpeg', [
        '-v', 'error',
        '-i', file,
        '-map', '0:v:0',
        '-vf', 'crop=64:64:(iw-64)/2:(ih-64)/2,scale=1:1,format=gray',
        '-fps_mode', 'passthrough',
        '-f', 'rawvideo',
        '-pix_fmt', 'gray',
        'pipe:1',
    ], { binary: true });
    const count = Math.min(frames.length, pixels.byteLength);
    if (count === 0) throw new Error(`${path.basename(file)} has no decoded video frames.`);
    let peakIndex = 0;
    let peakLuma = -1;
    for (let index = 0; index < count; index += 1) {
        if (pixels[index] > peakLuma) {
            peakLuma = pixels[index];
            peakIndex = index;
        }
    }
    return {
        peakLuma,
        peakTimeSeconds: finiteNumber(frames[peakIndex]?.best_effort_timestamp_time),
        decodedFrameCount: count,
    };
};

const inspectMedia = async (browser, matrixEntry) => {
    const file = path.resolve(matrixEntry.file);
    await access(file);
    const match = path.basename(file).match(
        /-(orthogonal-lines|cube-swarm)-(720p|1080p)(30|60)fps\.webm$/,
    );
    if (!match) throw new Error(`Unexpected V5 output filename: ${path.basename(file)}`);
    const [, template, resolution, frameRateText] = match;
    const frameRate = Number(frameRateText);
    const expected = resolution === '720p'
        ? { width: 1280, height: 720 }
        : { width: 1920, height: 1080 };
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
        throw new Error(`${path.basename(file)} must contain exactly one video and one audio stream.`);
    }
    const video = videoStreams[0];
    const audio = audioStreams[0];
    if (!supportedVideoCodecs.has(video.codec_name) || audio.codec_name !== 'opus') {
        throw new Error(`${path.basename(file)} must use VP9/VP8 video plus Opus audio.`);
    }
    if (video.width !== expected.width || video.height !== expected.height) {
        throw new Error(`${path.basename(file)} has ${video.width}x${video.height}; expected ${expected.width}x${expected.height}.`);
    }
    if (!String(probe.format?.format_name).split(',').some((name) => ['webm', 'matroska'].includes(name))) {
        throw new Error(`${path.basename(file)} is not a WebM/Matroska container.`);
    }

    const packets = probe.packets ?? [];
    const videoPackets = packets
        .filter((packet) => packet.stream_index === video.index)
        .sort((left, right) => Number(left.pts_time) - Number(right.pts_time));
    const audioPackets = packets
        .filter((packet) => packet.stream_index === audio.index)
        .sort((left, right) => Number(left.pts_time) - Number(right.pts_time));
    if (videoPackets.length < frameRate * 2 || audioPackets.length === 0) {
        throw new Error(`${path.basename(file)} does not contain enough A/V packets.`);
    }
    const metadataFrameRate = parseFraction(video.avg_frame_rate);
    const firstVideoTime = Number(videoPackets[0].pts_time);
    const lastVideoTime = Number(videoPackets.at(-1).pts_time);
    const packetFrameRate = (videoPackets.length - 1) / (lastVideoTime - firstVideoTime);
    const averageFrameRate = Number.isFinite(metadataFrameRate) && metadataFrameRate > 0
        ? metadataFrameRate
        : packetFrameRate;
    if (!Number.isFinite(averageFrameRate)
        || Math.abs(averageFrameRate - frameRate) > frameRate * 0.05) {
        throw new Error(`${path.basename(file)} average frame rate ${averageFrameRate} misses ${frameRate}fps ±5%.`);
    }
    let maxVideoPacketGapSeconds = 0;
    for (let index = 1; index < videoPackets.length; index += 1) {
        maxVideoPacketGapSeconds = Math.max(
            maxVideoPacketGapSeconds,
            Number(videoPackets[index].pts_time) - Number(videoPackets[index - 1].pts_time),
        );
    }
    if (maxVideoPacketGapSeconds > (2 / frameRate) + 0.001) {
        throw new Error(`${path.basename(file)} video packet gap ${maxVideoPacketGapSeconds}s exceeds two target intervals.`);
    }
    const videoEndSeconds = packetEnd(videoPackets);
    const audioEndSeconds = packetEnd(audioPackets);
    const containerDurationMetadataSeconds = finiteNumber(probe.format?.duration);
    const containerStartSeconds = finiteNumber(probe.format?.start_time) ?? 0;
    // Chrome and Edge emit live WebM without a seekable Duration element. In
    // that valid case ffprobe reports N/A, so verify the container timeline by
    // the final demuxed packet rather than weakening the duration gate.
    const containerDurationSeconds = containerDurationMetadataSeconds
        ?? Math.max(videoEndSeconds, audioEndSeconds) - containerStartSeconds;
    for (const [label, duration] of [
        ['container', containerDurationSeconds],
        ['video', videoEndSeconds],
        ['audio', audioEndSeconds],
    ]) {
        if (duration === null || Math.abs(duration - fixtureDurationSeconds) > durationLimitSeconds) {
            throw new Error(`${path.basename(file)} ${label} duration ${duration}s misses 3s ±250ms.`);
        }
    }
    const audioVideoEndDeltaSeconds = Math.abs(audioEndSeconds - videoEndSeconds);
    if (audioVideoEndDeltaSeconds > syncLimitSeconds) {
        throw new Error(`${path.basename(file)} A/V end delta ${audioVideoEndDeltaSeconds}s exceeds 100ms.`);
    }

    const audioSignal = inspectAudio(file);
    if (!Number.isFinite(audioSignal.peakRms) || audioSignal.peakRms < 0.001) {
        throw new Error(`${path.basename(file)} is silent despite the pre-Gain recording tap.`);
    }
    const centerBrightness = template === 'orthogonal-lines'
        ? inspectCenterBrightness(file)
        : null;
    const peakSyncDeltaSeconds = centerBrightness?.peakTimeSeconds === null
        || centerBrightness === null
        ? null
        : Math.abs(audioSignal.peakTimeSeconds - centerBrightness.peakTimeSeconds);
    if (peakSyncDeltaSeconds !== null && peakSyncDeltaSeconds > syncLimitSeconds) {
        throw new Error(`${path.basename(file)} audio/video peak delta ${peakSyncDeltaSeconds}s exceeds 100ms.`);
    }

    const bytes = await readFile(file);
    return {
        browser,
        template,
        preset: `${resolution}${frameRate}`,
        file: path.relative(repositoryRoot, file),
        byteLength: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        codecs: { video: video.codec_name, audio: audio.codec_name },
        dimensions: expected,
        targetFrameRate: frameRate,
        averageFrameRate,
        averageFrameRateSource: Number.isFinite(metadataFrameRate) && metadataFrameRate > 0
            ? 'stream-metadata'
            : 'packet-timeline',
        maxVideoPacketGapSeconds,
        containerDurationSeconds,
        containerDurationMetadataSeconds,
        containerDurationSource: containerDurationMetadataSeconds === null
            ? 'demuxed-packet-timeline'
            : 'format-duration',
        videoEndSeconds,
        audioEndSeconds,
        audioVideoEndDeltaSeconds,
        audioSignal,
        centerBrightness,
        peakSyncDeltaSeconds,
    };
};

const browserReports = [];
const verifiedFiles = [];
for (const browser of ['chrome', 'edge']) {
    const matrixPath = path.join(artifactRoot, browser, 'capability-matrix.json');
    const capability = JSON.parse(await readFile(matrixPath, 'utf8'));
    if (capability.browser !== browser || !Array.isArray(capability.matrix)) {
        throw new Error(`${matrixPath} is not a valid V5 capability matrix.`);
    }
    const requiredSaved = [
        ['orthogonal-lines', '720p30'],
        ['cube-swarm', '720p30'],
    ];
    for (const [template, preset] of requiredSaved) {
        const entry = capability.matrix.find((candidate) =>
            candidate.template === template && candidate.preset === preset);
        if (entry?.status !== 'saved') {
            throw new Error(`${browser} ${template} ${preset} must produce a real WebM.`);
        }
    }
    for (const preset of ['720p30', '720p60', '1080p30', '1080p60']) {
        const entry = capability.matrix.find((candidate) =>
            candidate.template === 'cube-swarm' && candidate.preset === preset);
        if (!entry || !['saved', 'unavailable'].includes(entry.status)) {
            throw new Error(`${browser} cube-swarm ${preset} lacks a capability result.`);
        }
        if (entry.status === 'unavailable' && entry.code !== 'preset-unavailable') {
            throw new Error(`${browser} cube-swarm ${preset} used an invalid unavailable code.`);
        }
    }
    for (const entry of capability.matrix.filter((candidate) => candidate.status === 'saved')) {
        verifiedFiles.push(await inspectMedia(browser, entry));
    }
    browserReports.push(capability);
}

await mkdir(artifactRoot, { recursive: true });
const report = {
    schemaVersion: 1,
    result: 'pass',
    fixtureDurationSeconds,
    thresholds: {
        frameRatePercent: 5,
        maximumVideoPacketIntervals: 2,
        durationDeltaSeconds: durationLimitSeconds,
        audioVideoEndDeltaSeconds: syncLimitSeconds,
        audioVideoPeakDeltaSeconds: syncLimitSeconds,
    },
    browserReports,
    files: verifiedFiles,
};
const reportPath = path.join(artifactRoot, 'sync-report.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
    metric: 'v5-media-verification',
    result: report.result,
    artifactRoot: path.relative(repositoryRoot, artifactRoot),
    files: verifiedFiles,
}));
