import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const manifest = JSON.parse(await fs.readFile('src/transcription/model-artifacts.json','utf8'));
const directory = 'artifacts/fixtures/transcription-models';
await fs.mkdir(directory,{recursive:true});
if (process.platform === 'win32') {
    const result = spawnSync('powershell.exe',['-NoProfile','-File','tests/transcription/download-models.ps1',
        ...(process.argv.includes('--verify-only') ? ['-VerifyOnly'] : [])],{stdio:'inherit',windowsHide:true});
    if (result.status !== 0) process.exit(result.status ?? 1);
}
const records = [];
for (const model of manifest.models) {
    if (!/^[a-f0-9]{40}$/.test(model.revision) || !/^[a-f0-9]{64}$/.test(model.sha256)
        || !/^[a-zA-Z0-9_.-]+\.onnx$/.test(model.file) || !Number.isSafeInteger(model.bytes) || model.bytes <= 0
        || !model.url.includes(`/${model.revision}/`)) throw Error('Invalid immutable model identity.');
    const target = `${directory}/${model.file}`;
    const digest = async() => {
        const hash = createHash('sha256'); let bytes = 0;
        for await (const chunk of createReadStream(target)) { hash.update(chunk); bytes += chunk.length; }
        return {bytes,sha256:hash.digest('hex')};
    };
    let actual;
    try { actual = await digest(); } catch { /* Explicit download or verify-only error follows. */ }
    if (actual?.bytes !== model.bytes || actual.sha256 !== model.sha256) {
        if (process.argv.includes('--verify-only') || process.platform === 'win32') throw Error(`${model.id}: asset missing or corrupt.`);
        const response = await fetch(model.url);
        if (!response.ok || !response.body) throw Error(`${model.id}: HTTP ${response.status}`);
        const file = await fs.open(target + '.partial','w');
        const hash = createHash('sha256'); let bytes = 0;
        try {
            for await (const chunk of response.body) {
                bytes += chunk.length;
                if (bytes > model.bytes) throw Error(`${model.id}: unexpected asset size.`);
                hash.update(chunk); await file.write(chunk);
            }
            if (bytes !== model.bytes || hash.digest('hex') !== model.sha256) throw Error(`${model.id}: checksum mismatch.`);
        } finally { await file.close(); }
        await fs.rename(target + '.partial',target);
        actual = await digest();
    }
    if (model.gitBlob) {
        const blob = createHash('sha1').update(`blob ${model.bytes}\0`);
        for await (const chunk of createReadStream(target)) blob.update(chunk);
        if (blob.digest('hex') !== model.gitBlob) throw Error(`${model.id}: upstream Git blob mismatch.`);
    }
    records.push({...model,...actual});
    console.log(`${model.id}: verified ${model.bytes} bytes ${model.sha256}`);
}
if (records.length !== 4) throw Error('Four transcription assets are required.');
await fs.writeFile(`${directory}/verified.json`,JSON.stringify(records,null,2) + '\n');
