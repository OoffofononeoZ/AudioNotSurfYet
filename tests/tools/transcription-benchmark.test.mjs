import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../transcription/analyze-benchmark.mjs', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('timing report verifies frozen-input provenance and keeps unmarked sounds unreviewed', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'transcription-metrics-'));
    const write = (file, data) =>
        fs.writeFile(path.join(directory, file), typeof data === 'string' ? data : JSON.stringify(data), 'utf8');
    try {
        await write('source.mp3', 'local test input');
        await write('stem.wav', 'frozen test stem');
        const sourceHash = hash('local test input');
        await write('stem.wav.json', { sourceHash });
        await write('manual.json', {
            track: { contentHash: sourceHash },
            lanes: [{ events: [{ atSeconds: 1 }] }, { events: [{ atSeconds: 121 }] }, { events: [] }],
        });
        await write('report.json', {
            stemHash: hash('frozen test stem'),
            answer: {
                result: {
                    hits: [{ startSeconds: 1.01 }, { startSeconds: 121.01 }, { startSeconds: 200 }],
                    totalMs: 10,
                    incomplete: [],
                },
            },
        });
        const args = [
            '--experimental-strip-types',
            script,
            '--report',
            'report.json',
            '--reference',
            'manual.json',
            '--source',
            'source.mp3',
            '--stem',
            'stem.wav',
        ];
        const first = spawnSync(process.execPath, args, { cwd: directory, encoding: 'utf8', windowsHide: true });
        assert.equal(first.status, 0, first.stderr);
        const report = JSON.parse(await fs.readFile(path.join(directory, 'report.timing.json'), 'utf8'));
        assert.equal(report.raw.recall, 1);
        assert.equal(report.raw.unreviewedObservedCount, 1);
        assert.equal(report.heldOutRaw.referenceCount, 1);
        assert.equal(report.raw.precision, undefined);
        await fs.unlink(path.join(directory, 'report.timing.json'));
        await write('stem.wav', 'different frozen input');
        const second = spawnSync(process.execPath, args, { cwd: directory, encoding: 'utf8', windowsHide: true });
        assert.notEqual(second.status, 0);
        assert.match(second.stderr, /provenance does not match/);
        await assert.rejects(fs.access(path.join(directory, 'report.timing.json')));
    } finally {
        // Only the uniquely created fixture directory owned by this test.
        await fs.rm(directory, { recursive: true });
    }
});
