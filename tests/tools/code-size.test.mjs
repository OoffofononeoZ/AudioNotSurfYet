import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
    CODE_SIZE_EXCEPTIONS,
    inspectCodeSize,
    validateCodeSizeExceptions,
} from '../../scripts/lib/code-size-policy.mjs';
import { ROOT, contained, isHandwrittenCode, lineCount } from '../../scripts/lib/repository.mjs';
import { inspectRepository } from '../../scripts/check-repo.mjs';
import { generateMaps } from '../../scripts/codemap.mjs';
import { installProjectSkills } from '../../scripts/install-project-skills.mjs';
import { fixture, bytes } from './fixture.mjs';

for (const [lines, warnings, errors] of [
    [1000, 0, 0],
    [1001, 0, 0],
    [1300, 0, 0],
    [1301, 1, 0],
    [2000, 1, 0],
    [2001, 0, 1],
]) {
    test(`${lines} handwritten lines yield ${warnings} warnings and ${errors} errors`, () => {
        const result = inspectCodeSize('src/large.ts', lines);
        assert.equal(result.warnings.length, warnings);
        assert.equal(result.errors.length, errors);
    });
}

test('physical lines include the whole Vue SFC, comments and blanks, independent of newline convention', () => {
    const lines = [
        '<template>',
        '    <div />',
        '</template>',
        '',
        '<script setup lang="ts">',
        '// comment',
        '</script>',
        '',
        '<style scoped>',
        'div { color: red; }',
        '</style>',
    ];
    for (const newline of ['\n', '\r\n', '\r']) {
        assert.equal(lineCount(lines.join(newline)), 11);
        assert.equal(lineCount(lines.join(newline) + newline), 11);
    }
    assert.equal(lineCount(''), 0);
    assert.equal(lineCount('\n'), 1);
});

test('handwritten source, tools, tests, root code config and CSS are included; generated/vendor/lock files are excluded', () => {
    for (const file of [
        'src/App.vue',
        'scripts/task.mjs',
        'tests/example.test.ts',
        'vite.config.ts',
        'src/style.css',
        'src/theme.scss',
        'src/theme.less',
        'public/index.html',
        'scripts/task.ps1',
    ]) {
        assert.equal(isHandwrittenCode(file), true, file);
        assert.equal(inspectCodeSize(file, 2001).errors.length, 1, file);
    }
    for (const file of [
        'src/vendor/copied.ts',
        'node_modules/dep/index.js',
        'src/third_party/task.js',
        'src/task.generated.ts',
        'src/__generated__/types.ts',
        'auto-imports.d.ts',
        'components.d.ts',
        'dist/task.js',
        '.agents/skills/task.mjs',
        'test-results/task.ts',
        'docs/notes.md',
        'package-lock.json',
    ]) {
        assert.equal(isHandwrittenCode(file), false, file);
        assert.deepEqual(inspectCodeSize(file, 3000), { errors: [], warnings: [] }, file);
    }
});

test('exception approval is file-specific and bounded; no real file is exempted by this workflow', () => {
    assert.deepEqual(CODE_SIZE_EXCEPTIONS, {});
    const exceptions = {
        'src/large.ts': {
            maxLines: 2200,
            reason: 'Synthetic inseparable parser table',
            approval: 'test-only owner decision',
        },
    };
    assert.deepEqual(validateCodeSizeExceptions(exceptions), []);
    for (const lines of [2001, 2200]) {
        const result = inspectCodeSize('src/large.ts', lines, exceptions);
        assert.deepEqual(result.errors, []);
        assert.equal(result.warnings.length, 1);
        assert.ok(result.warnings[0].includes(exceptions['src/large.ts'].approval));
    }
    assert.equal(inspectCodeSize('src/large.ts', 2201, exceptions).errors.length, 1);
    assert.equal(inspectCodeSize('src/other.ts', 2001, exceptions).errors.length, 1);
});

test('wildcards, noncanonical paths and missing approval metadata cannot grant exceptions', () => {
    const entry = { maxLines: 2200, reason: 'Test', approval: 'test-only decision' };
    for (const file of [
        'src/*.ts',
        'src/**/x.ts',
        '../outside.ts',
        '/outside.ts',
        'C:/outside.ts',
        'src\\large.ts',
        'src/../large.ts',
        'src/vendor/copied.ts',
    ]) {
        const exceptions = { [file]: entry };
        assert.ok(validateCodeSizeExceptions(exceptions).length, file);
        assert.equal(inspectCodeSize('src/large.ts', 2001, exceptions).errors.length, 1);
    }
    for (const invalid of [
        { ...entry, approval: '' },
        { ...entry, reason: '' },
        { ...entry, maxLines: 2000 },
        { ...entry, maxLines: Infinity },
        { ...entry, maxLines: 2200.5 },
        { ...entry, unknown: true },
    ]) {
        const exceptions = { 'src/large.ts': invalid };
        assert.ok(validateCodeSizeExceptions(exceptions).length);
        assert.equal(inspectCodeSize('src/large.ts', 2001, exceptions).errors.length, 1);
    }
    assert.ok(validateCodeSizeExceptions(null).length);
});

test('repository inspection enforces root config and CSS size without changing document hints', t => {
    const root = fixture(t, {
        'vite.config.ts': '// config\n'.repeat(2001),
        'src/style.css': '/* rule */\n'.repeat(1301),
        'docs/long.md': 'text\n'.repeat(501),
    });
    installProjectSkills(root);
    generateMaps(root);
    const result = inspectRepository(root);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0].includes('vite.config.ts'));
    assert.equal(result.warnings.length, 2);
    const approved = inspectRepository(root, {
        codeSizeExceptions: {
            'vite.config.ts': { maxLines: 2100, reason: 'Test-only config', approval: 'test-only owner decision' },
        },
    });
    assert.deepEqual(approved.errors, []);
    assert.equal(approved.warnings.length, 3);
});

test('repo check exits nonzero for >2000 Vue lines and changes neither source, map nor Git index', t => {
    const root = fixture(t, { 'src/Large.vue': '<template>\n<div />\n</template>\n' + '\n'.repeat(1998) });
    fs.cpSync(contained(ROOT, 'scripts'), contained(root, 'scripts'), { recursive: true });
    installProjectSkills(root);
    generateMaps(root);
    const files = ['src/Large.vue', 'docs/CODEMAP.md'];
    const before = files.map(file => bytes(root, file));
    const index = path.join(root, '.git', 'index');
    const indexBefore = fs.existsSync(index) ? fs.readFileSync(index) : null;
    const result = spawnSync(process.execPath, [contained(root, 'scripts/check-repo.mjs')], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes('src/Large.vue'));
    assert.ok(result.stderr.includes('2000'));
    files.forEach((file, i) => assert.deepEqual(bytes(root, file), before[i]));
    assert.deepEqual(fs.existsSync(index) ? fs.readFileSync(index) : null, indexBefore);
});
