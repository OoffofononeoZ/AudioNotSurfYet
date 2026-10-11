import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, contained, git } from '../../scripts/lib/repository.mjs';

export function write(root, file, text) {
  const target = contained(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
}

export function fixture(t, entries = {}) {
  const base = contained(ROOT, 'test-results');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'repository-tools-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(base));
    assert.ok(path.basename(root).startsWith('repository-tools-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  git(root, ['init', '-b', 'main']);
  write(root, 'AGENTS.md', '# Fixture\n');
  write(root, '.gitignore', 'node_modules/\ndist/\n');
  fs.mkdirSync(contained(root, 'skills'), { recursive: true });
  for (const [file, content] of Object.entries(entries)) write(root, file, content);
  return root;
}

export function bytes(root, file) { return fs.readFileSync(contained(root, file)); }

export function skill(name, description = '用于本项目工具行为验证') {
  return `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n# Skill\n`;
}
