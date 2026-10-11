import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { ROOT, contained, listFiles, lineCount, skillMetadata } from '../../scripts/lib/repository.mjs';
import { inspectSources } from '../../scripts/lib/source-map.mjs';
import { buildMaps, generateMaps, staleMaps } from '../../scripts/codemap.mjs';
import { inspectDocuments, inspectRepository } from '../../scripts/check-repo.mjs';
import { fixture, write, bytes, skill } from './fixture.mjs';
import { installProjectSkills } from '../../scripts/install-project-skills.mjs';

test('Vue and TS imports resolve relative paths, @ alias, re-exports and literal dynamic imports', t => {
  const entries = {
    'src/App.vue': '<template><p>import fake</p></template>\n<script setup lang="ts">\nimport { convert } from "@/audio";\nimport "./style.ts";\n</script>\n',
    'src/audio.ts': 'export const convert = () => 1;\n',
    'src/style.ts': 'export {};\n',
    'src/processing/task.ts': 'export { convert } from "../audio.js";\nconst module = await import("../style.ts");\n',
  };
  const root = fixture(t, entries);
  const records = inspectSources(root, Object.keys(entries));
  assert.deepEqual(records.find(r => r.file === 'src/App.vue').imports, ['src/audio.ts', 'src/style.ts']);
  assert.deepEqual(records.find(r => r.file === 'src/processing/task.ts').imports, ['src/audio.ts', 'src/style.ts']);
  assert.equal(records.find(r => r.file === 'src/processing/task.ts').area, 'processing');
});

test('maps remain stable and detect additions, renames, deletions and changed imports', t => {
  const root = fixture(t, { 'src/first.ts': 'export const first = 1;\n' });
  generateMaps(root);
  const initial = buildMaps(root);
  assert.deepEqual(generateMaps(root), []);
  assert.deepEqual(staleMaps(root), []);
  write(root, 'src/second.ts', 'import "./first.ts";\n');
  assert.ok(staleMaps(root).length);
  generateMaps(root);
  write(root, 'src/second.ts', 'export {};\n');
  assert.ok(staleMaps(root).length);
  generateMaps(root);
  fs.renameSync(contained(root, 'src/second.ts'), contained(root, 'src/third.ts'));
  assert.ok(staleMaps(root).length);
  generateMaps(root);
  fs.unlinkSync(contained(root, 'src/third.ts'));
  generateMaps(root);
  assert.deepEqual(buildMaps(root), initial);
});

test('pagination cleans obsolete owned pages and preserves handwritten documents', t => {
  const entries = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`src/item-${i}.ts`, 'export {};\n']));
  const root = fixture(t, entries);
  generateMaps(root);
  assert.ok(fs.existsSync(contained(root, 'docs/codemap/shared-2.md')));
  write(root, 'docs/codemap/notes.md', '# Manual notes\n');
  fs.unlinkSync(contained(root, 'src/item-100.ts'));
  generateMaps(root);
  assert.equal(fs.existsSync(contained(root, 'docs/codemap/shared-2.md')), false);
  assert.equal(bytes(root, 'docs/codemap/notes.md').toString(), '# Manual notes\n');
});

test('check CLIs return failure for stale output without writing bytes or the index', t => {
  const root = fixture(t, { 'src/first.ts': 'export {};\n' });
  fs.cpSync(contained(ROOT, 'scripts'), contained(root, 'scripts'), { recursive: true });
  installProjectSkills(root);
  generateMaps(root);
  const map = bytes(root, 'docs/CODEMAP.md');
  const gitIndex = path.join(root, '.git', 'index');
  const beforeIndex = fs.existsSync(gitIndex) ? fs.readFileSync(gitIndex) : null;
  write(root, 'src/processing/new.ts', 'export {};\n');
  for (const script of ['scripts/codemap.mjs', 'scripts/check-repo.mjs']) {
    const result = spawnSync(process.execPath, [contained(root, script), ...(script.includes('codemap') ? ['--check'] : [])], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1, result.stderr);
    assert.deepEqual(bytes(root, 'docs/CODEMAP.md'), map);
  }
  assert.deepEqual(fs.existsSync(gitIndex) ? fs.readFileSync(gitIndex) : null, beforeIndex);
});

test('scale hints do not fail validation and exclude generated and vendor code', t => {
  const longSource = '// line\n'.repeat(501);
  const root = fixture(t, {
    'src/large.ts': longSource, 'src/vendor/copied.ts': longSource,
    'src/schema.generated.ts': longSource, 'docs/long.md': 'details\n'.repeat(301),
  });
  installProjectSkills(root);
  generateMaps(root);
  const result = inspectRepository(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 2);
  assert.equal(lineCount('one\ntwo\n'), 2);
});

test('documents without lifecycle metadata and readiness-stage labels can pass', t => {
  const root = fixture(t, {
    'docs/quality/release-readiness.md': '# Scoped notes\n[Root](../../AGENTS.md)\n',
    'docs/notes.md': '[Missing](missing.md)\n[External](https://example.com/)\n```md\n[Example](not-real.md)\n```\n[^1]: A footnote, not a path.\n',
  });
  assert.equal(inspectDocuments(root).errors.length, 1);
  write(root, 'docs/missing.md', '# Found\n');
  assert.deepEqual(inspectDocuments(root).errors, []);
  write(root, 'docs/notes.md', '[No access](../trash/forbidden.md)\n');
  assert.ok(inspectDocuments(root).errors.some(e => e.includes('禁止访问 trash')));
});

test('archive exclusion happens before reads and forbidden traversal or links are rejected', t => {
  const root = fixture(t, { 'src/first.ts': 'export {};\n' });
  // Synthetic sentinel is never read or traversed; no real archive is involved.
  fs.mkdirSync(path.join(root, 'trash'), { recursive: true });
  fs.writeFileSync(path.join(root, 'trash', 'sentinel.ts'), 'DO NOT READ');
  const originalRead = fs.readFileSync;
  const originalList = fs.readdirSync;
  fs.readFileSync = function(file, ...args) {
    assert.ok(!/(?:^|[\\/])trash(?:[\\/]|$)/i.test(String(file)), 'archive read attempted');
    return originalRead.call(this, file, ...args);
  };
  fs.readdirSync = function(file, ...args) {
    assert.ok(!/(?:^|[\\/])trash(?:[\\/]|$)/i.test(String(file)), 'archive traversal attempted');
    return originalList.call(this, file, ...args);
  };
  try {
    assert.ok(!listFiles(root).some(f => /trash/.test(f)));
    buildMaps(root);
    inspectDocuments(root);
    assert.throws(() => contained(root, '../outside.md'), /超出仓库/);
    assert.throws(() => contained(root, 'docs/../trash/sentinel.ts'), /禁止访问/);
  } finally { fs.readFileSync = originalRead; fs.readdirSync = originalList; }
  const external = fixture(t, { 'outside.md': '# Outside\n' });
  fs.symlinkSync(external, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => contained(root, 'linked/outside.md'), /拒绝跟随/);
});

test('generation collision refuses writes and skill optional metadata is preserved', t => {
  const root = fixture(t, { 'docs/CODEMAP.md': '# Manual content\n' });
  assert.throws(() => generateMaps(root), /非生成文档/);
  assert.equal(bytes(root, 'docs/CODEMAP.md').toString(), '# Manual content\n');
  assert.equal(skillMetadata(skill('example') + '\n').name, 'example');
  assert.equal(skillMetadata(skill('example').replace('\n---\n\n', '\nmetadata:\n  short-description: "Optional"\n---\n\n')).name, 'example');
  assert.throws(() => skillMetadata('---\nname: example\ndescription: |\n  complex\n---\n'));
});
