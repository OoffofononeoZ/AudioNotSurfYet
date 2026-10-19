import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compileExecutableCatalog, sealExecutablePackages } from '../../scripts/lib/visualizer-resource-v2.mjs';
const fixture = () => ({
    format: 'audiosurf-visualizer-resource',
    schemaVersion: 2,
    id: 'sample',
    version: 1,
    algorithms: [{ id: 'new', version: 1, source: 'export function create() {}', contract: {}, programs: {} }],
    elements: [{ id: 'leaf', version: 1, algorithm: { id: 'new', version: 1, hash: '' } }],
    presets: [{ id: 'group', version: 1, elements: [{ element: { id: 'leaf', version: 1, hash: '' } }] }],
});
test('algorithm changes propagate through exact element and preset identities', () => {
    const input = fixture(),
        before = structuredClone(input);
    const [one] = sealExecutablePackages([input]);
    assert.deepEqual(input, before);
    assert.deepEqual(sealExecutablePackages([one]), [one]);
    input.algorithms[0].source += '\n// change';
    const [two] = sealExecutablePackages([input]);
    for (const key of ['algorithms', 'elements', 'presets']) assert.notEqual(one[key][0].hash, two[key][0].hash);
});
test('authoring compiler is deterministic, contained and has a read-only check', () => {
    const dir = mkdtempSync(join(tmpdir(), 'visualizer-executable-'));
    try {
        const pack = fixture();
        pack.algorithms[0].entry = 'draw.mjs';
        delete pack.algorithms[0].source;
        writeFileSync(join(dir, 'catalog.json'), JSON.stringify({ packages: ['pack.json'] }));
        writeFileSync(join(dir, 'pack.json'), JSON.stringify(pack));
        writeFileSync(join(dir, 'draw.mjs'), 'export function create() {}');
        const out = join(dir, 'output');
        compileExecutableCatalog(dir, out);
        const before = readFileSync(join(out, 'pack.json'), 'utf8');
        compileExecutableCatalog(dir, out, true);
        assert.equal(readFileSync(join(out, 'pack.json'), 'utf8'), before);
        writeFileSync(join(dir, 'draw.mjs'), 'import "https://example.com/remote.mjs"');
        assert.throws(() => compileExecutableCatalog(dir, out), /self-contained/);
        assert.equal(readFileSync(join(out, 'pack.json'), 'utf8'), before);
        pack.algorithms[0].entry = '../escape.mjs';
        writeFileSync(join(dir, 'pack.json'), JSON.stringify(pack));
        assert.throws(() => compileExecutableCatalog(dir, out), /escapes/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
