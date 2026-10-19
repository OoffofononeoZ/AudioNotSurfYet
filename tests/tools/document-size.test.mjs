import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { inspectDocumentSize, inspectDocuments, inspectRepository } from '../../scripts/check-repo.mjs';
import { generateMaps, MARKER } from '../../scripts/codemap.mjs';
import { installProjectSkills } from '../../scripts/install-project-skills.mjs';
import { ROOT, contained, lineCount } from '../../scripts/lib/repository.mjs';
import { fixture, write, bytes, skill } from './fixture.mjs';

for (const [lines, warnings, errors] of [
    [500, 0, 0],
    [501, 1, 0],
    [799, 1, 0],
    [800, 0, 1],
    [801, 0, 1],
]) {
    test(`${lines} document lines yield ${warnings} warnings and ${errors} errors`, () => {
        const result = inspectDocumentSize('docs/notes.md', 'details\n'.repeat(lines));
        assert.equal(result.warnings.length, warnings);
        assert.equal(result.errors.length, errors);
    });
}

test('root guides, README, skills and ordinary documents share the same boundaries', () => {
    for (const file of ['AGENTS.md', 'README.md', 'skills/example/SKILL.md', 'docs/contracts.md']) {
        assert.deepEqual(inspectDocumentSize(file, 'details\n'.repeat(500)), { errors: [], warnings: [] }, file);
        assert.equal(inspectDocumentSize(file, 'details\n'.repeat(501)).warnings.length, 1, file);
        assert.equal(inspectDocumentSize(file, 'details\n'.repeat(800)).errors.length, 1, file);
    }
});

test('normal layout, frontmatter and code blocks count as document lines, with LF/CRLF equivalence', () => {
    const lines = [
        '---',
        'title: Example',
        '---',
        '',
        '# Contract',
        '',
        '```ts',
        ...Array(790).fill('// example'),
        '```',
        '',
    ];
    assert.equal(lines.length, 799);
    for (const newline of ['\n', '\r\n']) {
        const text = lines.join(newline) + newline;
        assert.equal(lineCount(text), 799);
        assert.equal(inspectDocumentSize('docs/contract.md', text).warnings.length, 1);
        assert.equal(inspectDocumentSize('docs/contract.md', text + 'One more line' + newline).errors.length, 1);
    }
});

test('only marked generated maps bypass document size, with no inline ignore or historical-document exception', () => {
    const text = MARKER + '\n' + 'generated row\n'.repeat(900);
    for (const file of ['docs/CODEMAP.md', 'docs/codemap/shared.md']) {
        assert.deepEqual(inspectDocumentSize(file, text), { errors: [], warnings: [] });
    }
    assert.equal(inspectDocumentSize('docs/codemap/manual.md', 'manual\n'.repeat(800)).errors.length, 1);
    assert.equal(inspectDocumentSize('docs/manual.md', text).errors.length, 1);
    assert.equal(
        inspectDocumentSize('docs/quality/evidence-index.md', '<!-- size-ignore -->\n' + 'record\n'.repeat(800)).errors
            .length,
        1,
    );
});

test('document inspection combines link failures and size failures without counting vendor or generated sources', t => {
    const root = fixture(t, {
        'docs/large.md': '[Missing](missing.md)\n' + 'contract\n'.repeat(799),
        'docs/warning.md': 'detail\n'.repeat(501),
        'docs/vendor/copied.md': 'third party\n'.repeat(900),
        'docs/notes.generated.md': 'generated\n'.repeat(900),
    });
    const result = inspectDocuments(root);
    assert.equal(result.errors.length, 2);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.count, 3);
    assert.ok(result.errors.some(message => message.includes('本地链接不存在')));
    assert.ok(result.errors.some(message => message.includes('800')));
});

test('skill metadata remains enforced alongside the uniform document policy', t => {
    const header = skill('example');
    const content = header + 'details\n'.repeat(501 - lineCount(header));
    const root = fixture(t, {
        'skills/example/SKILL.md': content,
        'AGENTS.md': '[Example](skills/example/SKILL.md)\n',
    });
    installProjectSkills(root);
    generateMaps(root);
    const result = inspectRepository(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.warnings.length, 1);
    write(root, 'skills/example/SKILL.md', content.replace('name: example', 'name: invalid-name'));
    assert.ok(inspectRepository(root).errors.some(message => message.includes('name 与目录名称不一致')));
});

test('repo and docs CLIs both reject 800 lines, allow 799 with a hint and never write files or Git index', t => {
    const root = fixture(t, { 'docs/large.md': 'contract\n'.repeat(800) });
    fs.cpSync(contained(ROOT, 'scripts'), contained(root, 'scripts'), { recursive: true });
    write(root, 'tests/docs/validate-docs.mjs', bytes(ROOT, 'tests/docs/validate-docs.mjs').toString());
    installProjectSkills(root);
    generateMaps(root);
    const index = path.join(root, '.git', 'index');
    const indexBefore = fs.existsSync(index) ? fs.readFileSync(index) : null;
    const before = bytes(root, 'docs/large.md');
    const map = bytes(root, 'docs/CODEMAP.md');
    const run = script =>
        spawnSync(process.execPath, [contained(root, script)], { cwd: root, encoding: 'utf8', windowsHide: true });
    for (const script of ['scripts/check-repo.mjs', 'tests/docs/validate-docs.mjs']) {
        const result = run(script);
        assert.equal(result.status, 1, result.stderr);
        assert.ok(result.stderr.includes('docs/large.md'));
        assert.ok(result.stderr.includes('800'));
        assert.deepEqual(bytes(root, 'docs/large.md'), before);
        assert.deepEqual(bytes(root, 'docs/CODEMAP.md'), map);
        assert.deepEqual(fs.existsSync(index) ? fs.readFileSync(index) : null, indexBefore);
    }
    write(root, 'docs/large.md', 'contract\n'.repeat(799));
    const shorter = bytes(root, 'docs/large.md');
    for (const script of ['scripts/check-repo.mjs', 'tests/docs/validate-docs.mjs']) {
        const result = run(script);
        assert.equal(result.status, 0, result.stderr);
        assert.ok(result.stderr.includes('500'));
        assert.deepEqual(bytes(root, 'docs/large.md'), shorter);
        assert.deepEqual(bytes(root, 'docs/CODEMAP.md'), map);
        assert.deepEqual(fs.existsSync(index) ? fs.readFileSync(index) : null, indexBefore);
    }
});
