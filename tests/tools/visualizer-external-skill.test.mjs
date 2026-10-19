import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetsRoot, assetsAvailable } from '../support/visualizer-assets.mjs';
import { buildLibrary } from '../../skills/visualizer-content-generator/scripts/resource-library.mjs';

test(
    'standalone library tool seals sources, keeps creation time, checks read-only and rejects escaping paths',
    { skip: !assetsAvailable },
    () => {
        const root = mkdtempSync(join(tmpdir(), 'external-skill-'));
        try {
            const dir = join(root, 'elements/solid');
            mkdirSync(join(dir, 'source'), { recursive: true });
            mkdirSync(join(root, 'presets'));
            cpSync(join(assetsRoot, 'elements/solid'), dir, { recursive: true });
            const pack = JSON.parse(readFileSync(join(dir, 'source/resource.json'), 'utf8'));
            const info = {
                schemaVersion: 1,
                resource: { id: 'solid' },
                kind: 'visual',
                title: pack.elements[0].title,
                description: 'Sample',
                creator: 'default',
                createdAt: '2026-10-20T00:00:00.000Z',
                previewPath: 'preview.svg',
                sourceEntry: 'source/resource.json',
                packagePath: 'resource-package.json',
                dependencies: [],
                order: 0,
            };
            const file = join(dir, 'resource-info.json');
            writeFileSync(file, JSON.stringify(info));
            buildLibrary(root);
            const sealed = readFileSync(file, 'utf8');
            buildLibrary(root, true);
            assert.equal(readFileSync(file, 'utf8'), sealed);
            assert.equal(JSON.parse(sealed).createdAt, info.createdAt);
            writeFileSync(join(dir, 'source/algorithms/solid.mjs'), 'export function create() { return {}; }');
            assert.throws(() => buildLibrary(root, true), /Stale/);
            writeFileSync(file, JSON.stringify({ ...JSON.parse(sealed), sourceEntry: '../escape.json' }));
            assert.throws(() => buildLibrary(root, true), /Invalid resource-info|Invalid relative/);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    },
);
