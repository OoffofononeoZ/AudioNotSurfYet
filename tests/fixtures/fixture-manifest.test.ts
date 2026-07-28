import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const MANIFEST_PATH = path.join(REPOSITORY_ROOT, 'tests/fixtures/fixture-manifest.json');

interface FixtureRecord {
    id: string;
    path: string;
    purpose: string;
    format: string;
    sha256: string;
    bytes: number;
    sampleRate: number;
    channels: number;
    durationSeconds: number;
    sourceId: string;
    generationCommand: string;
    generatorVersion: string;
    encoder: {
        name: string;
        version: string;
        parameters: string[];
        commandTemplate?: string;
    };
    license: string;
    provenance: string;
}

interface FixtureManifest {
    schemaVersion: number;
    generatedAt: string;
    generator: {
        id: string;
        path: string;
        nodeVersion: string;
        ffmpegVersion: string;
    };
    license: {
        spdx: string;
        noticePath: string;
    };
    fixtures: FixtureRecord[];
}

async function loadManifest(): Promise<FixtureManifest> {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as FixtureManifest;
}

describe('fixture manifest', () => {
    test('contains one canonical master and three encoded formats', async () => {
        const manifest = await loadManifest();
        expect(manifest.schemaVersion).toBe(1);
        expect(manifest.license.spdx).toBe('CC0-1.0');
        expect(manifest.fixtures.map((fixture) => fixture.format).sort()).toEqual([
            'f32le',
            'flac',
            'mp3',
            'wav',
        ]);
        expect(new Set(manifest.fixtures.map((fixture) => fixture.id)).size).toBe(4);
    });

    test('matches every committed file hash and byte count', async () => {
        const manifest = await loadManifest();
        for (const fixture of manifest.fixtures) {
            const filePath = path.join(REPOSITORY_ROOT, fixture.path);
            const bytes = await readFile(filePath);
            expect(createHash('sha256').update(bytes).digest('hex'), fixture.id).toBe(
                fixture.sha256,
            );
            expect((await stat(filePath)).size, fixture.id).toBe(fixture.bytes);
            expect(fixture.sampleRate, fixture.id).toBe(48_000);
            expect(fixture.channels, fixture.id).toBe(1);
            expect(fixture.license, fixture.id).toBe('CC0-1.0');
            expect(fixture.provenance, fixture.id).not.toBe('');
            expect(fixture.generationCommand, fixture.id).not.toBe('');
            expect(fixture.encoder.version, fixture.id).not.toBe('');
            if (fixture.format !== 'f32le') {
                expect(fixture.encoder.commandTemplate, fixture.id).toContain('<temp>');
            }
        }
    });

    test.each(['wav', 'mp3', 'flac'])('is inspectable as %s by ffprobe', async (format) => {
        const manifest = await loadManifest();
        const fixture = manifest.fixtures.find((candidate) => candidate.format === format);
        expect(fixture).toBeDefined();
        const result = spawnSync(
            'ffprobe',
            ['-v', 'error', '-show_entries', 'stream=sample_rate,channels', '-of', 'json', fixture!.path],
            {
                cwd: REPOSITORY_ROOT,
                encoding: 'utf8',
            },
        );
        expect(result.status, result.stderr).toBe(0);
        const probe = JSON.parse(result.stdout) as {
            streams: Array<{ sample_rate: string; channels: number }>;
        };
        expect(probe.streams[0]).toEqual({
            sample_rate: '48000',
            channels: 1,
        });
    });
});
