import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { contained } from '../../scripts/lib/repository.mjs';
import { installProjectSkills } from '../../scripts/install-project-skills.mjs';
import { fixture, write, bytes, skill } from './fixture.mjs';

test('discovery entries resolve to source and synchronize metadata and existing UI policy', t => {
  const root = fixture(t, {
    'skills/example/SKILL.md': skill('example'),
    'skills/example/agents/openai.yaml': 'policy:\n  allow_implicit_invocation: true\n',
  });
  assert.equal(installProjectSkills(root), 1);
  const entry = '.agents/skills/example/SKILL.md';
  const before = bytes(root, entry);
  const target = before.toString().match(/\[项目维护源\]\(([^)]+)\)/)[1];
  assert.equal(path.resolve(path.dirname(contained(root, entry)), target), contained(root, 'skills/example/SKILL.md'));
  assert.equal(installProjectSkills(root, true), 1);
  write(root, 'skills/example/SKILL.md', skill('example', '修改后的说明'));
  assert.throws(() => installProjectSkills(root, true), /过期/);
  assert.deepEqual(bytes(root, entry), before);
  installProjectSkills(root);
  assert.ok(bytes(root, entry).toString().includes('修改后的说明'));
  assert.ok(bytes(root, '.agents/skills/example/agents/openai.yaml').toString().includes('allow_implicit_invocation: true'));
});

test('check of absent discovery never creates its directory', t => {
  const root = fixture(t, { 'skills/example/SKILL.md': skill('example') });
  assert.throws(() => installProjectSkills(root, true), /缺失或过期/);
  assert.equal(fs.existsSync(contained(root, '.agents')), false);
});

test('renaming or removing source cleans only owned generated files', t => {
  const root = fixture(t, { 'skills/old/SKILL.md': skill('old') });
  installProjectSkills(root);
  write(root, '.agents/skills/old/notes.md', '# Manual notes\n');
  fs.unlinkSync(contained(root, 'skills/old/SKILL.md'));
  write(root, 'skills/new/SKILL.md', skill('new'));
  assert.throws(() => installProjectSkills(root, true), /过期/);
  assert.equal(installProjectSkills(root), 1);
  assert.equal(fs.existsSync(contained(root, '.agents/skills/old/SKILL.md')), false);
  assert.equal(bytes(root, '.agents/skills/old/notes.md').toString(), '# Manual notes\n');
  assert.ok(fs.existsSync(contained(root, '.agents/skills/new/SKILL.md')));
});

test('manual entry collisions fail before other expected entries are written', t => {
  const root = fixture(t, {
    'skills/first/SKILL.md': skill('first'), 'skills/second/SKILL.md': skill('second'),
    '.agents/skills/second/SKILL.md': '# Manual skill\n',
  });
  assert.throws(() => installProjectSkills(root), /非本工具生成/);
  assert.equal(fs.existsSync(contained(root, '.agents/skills/first/SKILL.md')), false);
  assert.equal(bytes(root, '.agents/skills/second/SKILL.md').toString(), '# Manual skill\n');
});

test('source naming mismatch is rejected before mutation', t => {
  const root = fixture(t, { 'skills/example/SKILL.md': skill('wrong') });
  assert.throws(() => installProjectSkills(root), /名称与目录/);
  assert.equal(fs.existsSync(contained(root, '.agents')), false);
});
