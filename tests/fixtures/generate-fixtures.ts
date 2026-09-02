import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
    copyFile,
    mkdir,
    mkdtemp,
    readFile,
    rename,
    rm,
    stat,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    FORMAT_MASTER_DURATION_SECONDS,
    GENERATOR_VERSION,
    SAMPLE_RATE,
    VISUALIZER_V3_GENERATOR_VERSION,
    VISUALIZER_V4_GENERATOR_VERSION,
    createFormatMaster,
    createVisualizerV3LinesFixture,
    createVisualizerV4CubeSwarmFixture,
    float32ToLittleEndianBuffer,
} from '../support/audio-fixtures.ts';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const AUDIO_DIRECTORY = path.join(REPOSITORY_ROOT, 'tests/fixtures/audio');
const MANIFEST_PATH = path.join(REPOSITORY_ROOT, 'tests/fixtures/fixture-manifest.json');
const GENERATED_AT = '2026-09-03';
const SOURCE_ID = 'format-master-pcm-v1';

interface CommandResult {
    command: string;
    stdout: string;
}

function run(command: string, args: string[]): CommandResult {
    const result = spawnSync(command, args, {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(' ')} failed (${result.status}):\n${result.stderr || result.stdout}`,
        );
    }
    return {
        command: [command, ...args].join(' '),
        stdout: result.stdout,
    };
}

async function sha256File(filePath: string): Promise<string> {
    return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

async function inspectAudio(filePath: string): Promise<{
    format: string;
    codec: string;
    sampleRate: number;
    channels: number;
    durationSeconds: number;
}> {
    const result = run('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'a:0',
        '-show_entries',
        'stream=codec_name,sample_rate,channels,duration',
        '-show_entries',
        'format=format_name,duration',
        '-of',
        'json',
        filePath,
    ]);
    const probe = JSON.parse(result.stdout) as {
        streams?: Array<{
            codec_name?: string;
            sample_rate?: string;
            channels?: number;
            duration?: string;
        }>;
        format?: {
            format_name?: string;
            duration?: string;
        };
    };
    const stream = probe.streams?.[0];
    if (!stream?.codec_name || !stream.sample_rate || !stream.channels) {
        throw new Error(`ffprobe returned incomplete audio metadata for ${filePath}`);
    }
    const duration = Number(stream.duration ?? probe.format?.duration);
    if (!Number.isFinite(duration)) {
        throw new Error(`ffprobe returned an invalid duration for ${filePath}`);
    }
    return {
        format: probe.format?.format_name ?? 'unknown',
        codec: stream.codec_name,
        sampleRate: Number(stream.sample_rate),
        channels: stream.channels,
        durationSeconds: duration,
    };
}

async function fixtureRecord(
    id: string,
    relativePath: string,
    purpose: string,
    format: string,
    command: string,
    encoderParameters: string[],
    ffmpegVersion: string,
    sourceId = SOURCE_ID,
    generatorVersion = GENERATOR_VERSION,
) {
    const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
    const metadata = await inspectAudio(absolutePath);
    return {
        id,
        path: relativePath,
        purpose,
        format,
        sha256: await sha256File(absolutePath),
        bytes: (await stat(absolutePath)).size,
        sampleRate: metadata.sampleRate,
        channels: metadata.channels,
        durationSeconds: metadata.durationSeconds,
        sourceId,
        generationCommand: 'npm run fixtures:generate',
        generatorVersion,
        encoder: {
            name: metadata.codec,
            version: ffmpegVersion,
            parameters: encoderParameters,
            commandTemplate: command,
        },
        license: 'CC0-1.0',
        provenance: 'Deterministically synthesized by tests/fixtures/generate-fixtures.ts',
    };
}

async function main(): Promise<void> {
    const ffmpegVersion = run('ffmpeg', ['-version']).stdout.split('\n')[0]?.trim();
    if (!ffmpegVersion) {
        throw new Error('Unable to read the FFmpeg version.');
    }

    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'audionotsurfyet-fixtures-'));
    try {
        const masterPath = path.join(temporaryDirectory, 'format-master.f32le');
        const wavPath = path.join(temporaryDirectory, 'format-master.wav');
        const mp3Path = path.join(temporaryDirectory, 'format-master.mp3');
        const flacPath = path.join(temporaryDirectory, 'format-master.flac');
        const visualizerV3MasterPath = path.join(temporaryDirectory, 'visualizer-v3-lines-v1.f32le');
        const visualizerV3WavPath = path.join(temporaryDirectory, 'visualizer-v3-lines-v1.wav');
        const visualizerV4MasterPath = path.join(temporaryDirectory, 'visualizer-v4-cube-swarm-v1.f32le');
        const visualizerV4WavPath = path.join(temporaryDirectory, 'visualizer-v4-cube-swarm-v1.wav');
        await writeFile(masterPath, float32ToLittleEndianBuffer(createFormatMaster()));
        await writeFile(
            visualizerV3MasterPath,
            float32ToLittleEndianBuffer(createVisualizerV3LinesFixture()),
        );
        await writeFile(
            visualizerV4MasterPath,
            float32ToLittleEndianBuffer(createVisualizerV4CubeSwarmFixture()),
        );

        const commonInput = [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-f',
            'f32le',
            '-ar',
            String(SAMPLE_RATE),
            '-ac',
            '1',
            '-i',
            masterPath,
            '-map_metadata',
            '-1',
            '-fflags',
            '+bitexact',
        ];
        const wavParameters = ['-flags:a', '+bitexact', '-c:a', 'pcm_s16le'];
        const mp3Parameters = [
            '-c:a',
            'libmp3lame',
            '-b:a',
            '192k',
            '-write_xing',
            '0',
            '-id3v2_version',
            '0',
        ];
        const flacParameters = [
            '-flags:a',
            '+bitexact',
            '-c:a',
            'flac',
            '-compression_level',
            '5',
        ];

        const wavCommand = run('ffmpeg', [...commonInput, ...wavParameters, wavPath]).command;
        const mp3Command = run('ffmpeg', [...commonInput, ...mp3Parameters, mp3Path]).command;
        const flacCommand = run('ffmpeg', [...commonInput, ...flacParameters, flacPath]).command;
        const visualizerV3Input = [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-f',
            'f32le',
            '-ar',
            String(SAMPLE_RATE),
            '-ac',
            '1',
            '-i',
            visualizerV3MasterPath,
            '-map_metadata',
            '-1',
            '-fflags',
            '+bitexact',
        ];
        const visualizerV3Command = run(
            'ffmpeg',
            [...visualizerV3Input, ...wavParameters, visualizerV3WavPath],
        ).command;
        const visualizerV4Input = [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-f',
            'f32le',
            '-ar',
            String(SAMPLE_RATE),
            '-ac',
            '1',
            '-i',
            visualizerV4MasterPath,
            '-map_metadata',
            '-1',
            '-fflags',
            '+bitexact',
        ];
        const visualizerV4Command = run(
            'ffmpeg',
            [...visualizerV4Input, ...wavParameters, visualizerV4WavPath],
        ).command;

        await mkdir(AUDIO_DIRECTORY, { recursive: true });
        await Promise.all([
            copyFile(masterPath, path.join(AUDIO_DIRECTORY, 'format-master.f32le')),
            copyFile(wavPath, path.join(AUDIO_DIRECTORY, 'format-master.wav')),
            copyFile(mp3Path, path.join(AUDIO_DIRECTORY, 'format-master.mp3')),
            copyFile(flacPath, path.join(AUDIO_DIRECTORY, 'format-master.flac')),
            copyFile(visualizerV3WavPath, path.join(AUDIO_DIRECTORY, 'visualizer-v3-lines-v1.wav')),
            copyFile(visualizerV4WavPath, path.join(AUDIO_DIRECTORY, 'visualizer-v4-cube-swarm-v1.wav')),
        ]);

        const masterRelativePath = 'tests/fixtures/audio/format-master.f32le';
        const masterAbsolutePath = path.join(REPOSITORY_ROOT, masterRelativePath);
        const master = {
            id: SOURCE_ID,
            path: masterRelativePath,
            purpose: 'Canonical deterministic PCM source for encoded format fixtures',
            format: 'f32le',
            sha256: await sha256File(masterAbsolutePath),
            bytes: (await stat(masterAbsolutePath)).size,
            sampleRate: SAMPLE_RATE,
            channels: 1,
            durationSeconds: FORMAT_MASTER_DURATION_SECONDS,
            sourceId: SOURCE_ID,
            generationCommand: 'npm run fixtures:generate',
            generatorVersion: GENERATOR_VERSION,
            encoder: {
                name: 'Node.js Float32LE writer',
                version: process.version,
                parameters: ['little-endian', 'float32', `sample-rate=${SAMPLE_RATE}`, 'channels=1'],
            },
            license: 'CC0-1.0',
            provenance: 'Deterministically synthesized by tests/fixtures/generate-fixtures.ts',
        };

        const fixtures = [
            master,
            await fixtureRecord(
                'format-master-wav-v1',
                'tests/fixtures/audio/format-master.wav',
                'WAV load/decode compatibility',
                'wav',
                wavCommand.replaceAll(temporaryDirectory, '<temp>'),
                wavParameters,
                ffmpegVersion,
            ),
            await fixtureRecord(
                'format-master-mp3-v1',
                'tests/fixtures/audio/format-master.mp3',
                'MP3 load/decode compatibility',
                'mp3',
                mp3Command.replaceAll(temporaryDirectory, '<temp>'),
                mp3Parameters,
                ffmpegVersion,
            ),
            await fixtureRecord(
                'format-master-flac-v1',
                'tests/fixtures/audio/format-master.flac',
                'FLAC load/decode compatibility',
                'flac',
                flacCommand.replaceAll(temporaryDirectory, '<temp>'),
                flacParameters,
                ffmpegVersion,
            ),
            await fixtureRecord(
                'visualizer-v3-lines-wav-v1',
                'tests/fixtures/audio/visualizer-v3-lines-v1.wav',
                'Visualizer V3 deterministic line response and boundary scenarios',
                'wav',
                visualizerV3Command.replaceAll(temporaryDirectory, '<temp>'),
                wavParameters,
                ffmpegVersion,
                'visualizer-v3-lines-pcm-v1',
                VISUALIZER_V3_GENERATOR_VERSION,
            ),
            await fixtureRecord(
                'visualizer-v4-cube-swarm-wav-v1',
                'tests/fixtures/audio/visualizer-v4-cube-swarm-v1.wav',
                'Visualizer V4 deterministic spectrum, energy, drum, orbit, and boundary scenarios',
                'wav',
                visualizerV4Command.replaceAll(temporaryDirectory, '<temp>'),
                wavParameters,
                ffmpegVersion,
                'visualizer-v4-cube-swarm-pcm-v1',
                VISUALIZER_V4_GENERATOR_VERSION,
            ),
        ];

        const manifest = {
            schemaVersion: 1,
            generatedAt: GENERATED_AT,
            generator: {
                id: GENERATOR_VERSION,
                path: 'tests/fixtures/generate-fixtures.ts',
                nodeVersion: process.version,
                ffmpegVersion,
            },
            license: {
                spdx: 'CC0-1.0',
                noticePath: 'tests/fixtures/CC0-1.0.txt',
            },
            fixtures,
        };
        const temporaryManifest = `${MANIFEST_PATH}.tmp`;
        await writeFile(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        await rename(temporaryManifest, MANIFEST_PATH);
        console.log(`Generated ${fixtures.length} fixture records with ${ffmpegVersion}.`);
    } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
}

await main();
