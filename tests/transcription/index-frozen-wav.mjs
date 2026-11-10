import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { hashFile } from '../../scripts/lib/desktop-native-runtime.mjs';

const value = flag => process.argv[process.argv.indexOf(flag) + 1];
for (const flag of ['--wav', '--wav-sha256', '--baseline-report', '--output'])
    if (!process.argv.includes(flag)) throw Error(`Missing ${flag}`);
const wav = path.resolve(value('--wav')),
    output = path.resolve(value('--output')),
    relative = path.relative(await fs.realpath(process.cwd()), output);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw Error('Write indices only within the workspace.');
const original = JSON.parse(await fs.readFile(value('--baseline-report'), 'utf8')),
    provenance = JSON.parse(await fs.readFile(`${wav}.json`, 'utf8')),
    stemHash = await hashFile(wav);
if (original.sourceHash !== provenance.sourceHash || stemHash !== value('--wav-sha256'))
    throw Error('Frozen source provenance changed.');
await fs.mkdir(output, { recursive: true });
const bundle = path.join(output, `dsp-${randomUUID()}.mjs`);
await build({
    stdin: {
        contents:
            "export {buildAcousticIndex, ACOUSTIC_CONFIG_HASH} from './src/transcription/acousticIndex.ts'; export {exampleHash} from './src/transcription/examples/types.ts';",
        resolveDir: process.cwd(),
        loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
});
const { buildAcousticIndex, exampleHash } = await import(pathToFileURL(bundle)),
    handle = await fs.open(wav, 'r');
try {
    const header = Buffer.alloc(44);
    await handle.read(header, 0, 44, 0);
    if (
        header.toString('ascii', 0, 4) !== 'RIFF' ||
        header.toString('ascii', 36, 40) !== 'data' ||
        header.readUInt16LE(20) !== 3 ||
        header.readUInt16LE(22) !== 2 ||
        header.readUInt32LE(24) !== 44100 ||
        header.readUInt16LE(34) !== 32 ||
        (await handle.stat()).size !== 44 + header.readUInt32LE(40)
    )
        throw Error('Expected the fixed stereo Float32 44100Hz FT WAV.');
    const frames = header.readUInt32LE(40) / 8;
    const index = await buildAcousticIndex(
        {
            frames,
            sampleRate: 44100,
            channels: 2,
            async read(channel, start, length) {
                const bytes = Buffer.alloc(length * 8),
                    result = await handle.read(bytes, 0, bytes.length, 44 + start * 8);
                if (result.bytesRead !== bytes.length) throw Error('Incomplete PCM read.');
                const output = new Float32Array(length);
                for (let i = 0; i < length; i++) output[i] = bytes.readFloatLE(i * 8 + channel * 4);
                return output;
            },
        },
        new AbortController().signal,
        () => {},
    );
    const arrays = [],
        metadata = {};
    for (const [name, value] of Object.entries(index)) {
        if (!(value instanceof Float32Array)) {
            metadata[name] = value;
            continue;
        }
        const file = `${name}.f32`,
            bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        await fs.writeFile(path.join(output, file), bytes);
        arrays.push({ name, file, bytes: bytes.byteLength, sha256: await hashFile(path.join(output, file)) });
    }
    const sourceKey = exampleHash([original.sourceHash, 'frozen-ft-drums', stemHash, index.configHash]);
    await fs.writeFile(
        path.join(output, 'index.json'),
        JSON.stringify(
            {
                sourceHash: original.sourceHash,
                sourceKey,
                inputKind: 'read-only frozen FT drums PCM; DSP probe, not application source-selection proof',
                stemHash,
                metadata,
                arrays,
            },
            null,
            2,
        ),
        'utf8',
    );
    await fs.writeFile(
        path.join(output, 'report.json'),
        JSON.stringify(
            {
                ...original,
                inputKind: 'frozen-ft-drums-diagnostic',
                stemHash,
                queries: original.queries.map(q => ({
                    ...q,
                    profile: { ...q.profile, sourceKey, matches: [], queryHash: null },
                })),
            },
            null,
            2,
        ),
        'utf8',
    );
    console.log(
        JSON.stringify({ output, sourceHash: original.sourceHash, stemHash, frames, configHash: index.configHash }),
    );
} finally {
    await handle.close();
}
