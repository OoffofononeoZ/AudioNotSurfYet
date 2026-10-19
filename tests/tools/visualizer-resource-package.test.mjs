import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sealPackage } from '../../scripts/visualizer-resource-package.mjs';

const tool = fileURLToPath(new URL('../../scripts/visualizer-resource-package.mjs', import.meta.url));
const input = () => ({
    format: 'audiosurf-visualizer-resource',
    schemaVersion: 2,
    id: 'example',
    version: 1,
    algorithms: [{ id: 'algorithm', version: 1, source: 'export function create() {}', hash: 'old' }],
    elements: [
        {
            id: 'element',
            version: 1,
            title: 'sample',
            hash: 'old',
            algorithm: { id: 'algorithm', version: 1, hash: 'old' },
        },
    ],
    presets: [
        { id: 'preset', version: 1, elements: [{ element: { id: 'element', version: 1, hash: 'old' } }], hash: 'old' },
    ],
});
test('seals nested definitions and updates same-package references without modifying input', () => {
    const value = input(),
        before = structuredClone(value),
        sealed = sealPackage(value);
    assert.deepEqual(value, before);
    assert.match(sealed.elements[0].hash, /^[a-f0-9]{64}$/);
    assert.equal(sealed.presets[0].elements[0].element.hash, sealed.elements[0].hash);
    assert.deepEqual(sealPackage(sealed), sealed);
    assert.equal(
        sealPackage({ ...value, elements: [{ ...value.elements[0], title: 'changed' }] }).elements[0].hash ===
            sealed.elements[0].hash,
        false,
    );
});
test('CLI check is read-only and detects stale hashes; sealing writes the requested file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'visualizer-resource-')),
        file = join(dir, 'package.json');
    try {
        writeFileSync(file, JSON.stringify(input()));
        const original = readFileSync(file, 'utf8');
        const check = spawnSync(process.execPath, [tool, '--check', file], { encoding: 'utf8', windowsHide: true });
        assert.equal(check.status, 1);
        assert.match(check.stderr, /Stale resource hash/);
        assert.equal(readFileSync(file, 'utf8'), original);
        const write = spawnSync(process.execPath, [tool, file], { encoding: 'utf8', windowsHide: true });
        assert.equal(write.status, 0);
        assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), sealPackage(input()));
        assert.equal(spawnSync(process.execPath, [tool, '--check', file], { windowsHide: true }).status, 0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
