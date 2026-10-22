import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { visualizerSkillPath, loadVisualizerLibraryTool } from '../../scripts/lib/visualizer-skill-path.mjs';

test('external skill defaults to the sibling library and supports an explicitly configured directory', async () => {
    const previous = process.env.VISUALIZER_SKILL_DIR;
    const dir = mkdtempSync(join(tmpdir(), 'visualizer-skill-path-'));
    try {
        delete process.env.VISUALIZER_SKILL_DIR;
        assert.equal(
            visualizerSkillPath(),
            resolve(import.meta.dirname, '../../../WheresYourElements/skill/visualizer-content-generator'),
        );
        mkdirSync(join(dir, 'scripts'));
        writeFileSync(join(dir, 'scripts/resource-library.mjs'), 'export const buildLibrary = () => 42;');
        process.env.VISUALIZER_SKILL_DIR = dir;
        assert.equal((await loadVisualizerLibraryTool()).buildLibrary(), 42);
    } finally {
        if (previous === undefined) delete process.env.VISUALIZER_SKILL_DIR;
        else process.env.VISUALIZER_SKILL_DIR = previous;
        rmSync(dir, { recursive: true, force: true });
    }
});

test('missing external skill blocks library commands without preventing generic package tool imports', () => {
    const env = { ...process.env, VISUALIZER_SKILL_DIR: join(tmpdir(), 'missing-visualizer-skill') };
    const cli = resolve(import.meta.dirname, '../../scripts/visualizer-resource-package.mjs');
    const missing = spawnSync(process.execPath, [cli, '--check-build'], { env, encoding: 'utf8', windowsHide: true });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Configure VISUALIZER_SKILL_DIR/);
    const imported = spawnSync(
        process.execPath,
        [
            '--input-type=module',
            '-e',
            `await import(${JSON.stringify(new URL('../../scripts/visualizer-resource-package.mjs', import.meta.url).href)})`,
        ],
        { env, encoding: 'utf8', windowsHide: true },
    );
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(imported.stdout, '');
});
