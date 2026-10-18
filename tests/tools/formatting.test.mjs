import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import * as prettier from 'prettier';
import postcss from 'postcss';
import { parse, compileTemplate } from 'vue/compiler-sfc';
import { ROOT, contained, lineCount } from '../../scripts/lib/repository.mjs';
import { fixture, write, bytes } from './fixture.mjs';

const config = JSON.parse(fs.readFileSync(contained(ROOT, '.prettierrc.json'), 'utf8'));
const prettierCli = fileURLToPath(import.meta.resolve('prettier/bin/prettier.cjs'));
const format = (source, filepath) => prettier.format(source, { ...config, filepath });

test('format expands compressed statements, preserves behavior and is idempotent', async () => {
    const source =
        'const values=[1,2];function total(){const a=values[0];const b=values[1];return a+b;}globalThis.answer=total();\n';
    const formatted = await format(source, 'example.js');
    assert.ok(lineCount(formatted) > lineCount(source));
    assert.ok(formatted.includes('    const a'));
    const originalContext = {},
        formattedContext = {};
    runInNewContext(source, originalContext);
    runInNewContext(formatted, formattedContext);
    assert.equal(formattedContext.answer, originalContext.answer);
    assert.equal(await format(formatted, 'example.js'), formatted);
});

test('Vue formatting preserves template semantics and attribute order without requiring one attribute per line', async () => {
    const source =
        '<template><button @click="go" :title="label" v-if="ready">{{label}}</button></template>\n<script setup lang="ts">const label:string="Hello";const ready=true;function go(){console.log(label);}</script>\n<style scoped>button{color:red;padding:4px;}</style>\n';
    const formatted = await format(source, 'example.vue');
    const before = parse(source),
        after = parse(formatted);
    assert.deepEqual(before.errors, []);
    assert.deepEqual(after.errors, []);
    const compile = source => compileTemplate({ source, filename: 'example.vue', id: 'format-test' });
    const originalTemplate = compile(before.descriptor.template.content);
    const formattedTemplate = compile(after.descriptor.template.content);
    assert.deepEqual(formattedTemplate.errors, []);
    assert.equal(formattedTemplate.code, originalTemplate.code);
    assert.ok(
        after.descriptor.template.content.indexOf('@click') < after.descriptor.template.content.indexOf(':title'),
    );
    assert.ok(after.descriptor.template.content.indexOf(':title') < after.descriptor.template.content.indexOf('v-if'));
    const declaration = (await format('<template><input v-model="value" type="text" /></template>', 'short.vue')).split(
        '\n',
    );
    assert.ok(declaration.some(line => line.includes('v-model=') && line.includes('type=')));
    assert.equal(await format(formatted, 'example.vue'), formatted);
});

test('CSS declarations expand without reordering or changing values; existing newline convention is preserved', async () => {
    const source = '.panel{color:red;padding:4px;}\n';
    const formatted = await format(source, 'example.css');
    const declarations = css => {
        const result = [];
        postcss.parse(css).walkDecls(declaration => result.push([declaration.prop, declaration.value]));
        return result;
    };
    assert.deepEqual(declarations(formatted), declarations(source));
    assert.ok(lineCount(formatted) > lineCount(source));
    assert.equal(await format(formatted, 'example.css'), formatted);
    const crlf = await format('const first=1;\r\nconst second=2;\r\n', 'example.ts');
    assert.ok(crlf.includes('\r\n'));
    assert.ok(!/(?<!\r)\n/.test(crlf));
});

function formattingFixture(t, entries) {
    const root = fixture(t, entries);
    for (const file of ['.prettierrc.json', '.prettierignore']) write(root, file, bytes(ROOT, file).toString());
    return root;
}
function runPrettier(root, args) {
    return spawnSync(process.execPath, [prettierCli, ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
}

test('format check is read-only; write mode changes only explicitly named handwritten files', t => {
    const root = formattingFixture(t, {
        'src/target.ts': 'const x=1;const y=2;\n',
        'src/untouched.ts': 'const z=3;\n',
    });
    const targetBefore = bytes(root, 'src/target.ts'),
        otherBefore = bytes(root, 'src/untouched.ts');
    const index = path.join(root, '.git', 'index');
    const indexBefore = fs.existsSync(index) ? fs.readFileSync(index) : null;
    const check = runPrettier(root, ['--check', 'src/target.ts']);
    assert.equal(check.status, 1, check.stderr);
    assert.deepEqual(bytes(root, 'src/target.ts'), targetBefore);
    const writeResult = runPrettier(root, ['--write', 'src/target.ts']);
    assert.equal(writeResult.status, 0, writeResult.stderr);
    assert.notDeepEqual(bytes(root, 'src/target.ts'), targetBefore);
    assert.deepEqual(bytes(root, 'src/untouched.ts'), otherBefore);
    assert.equal(runPrettier(root, ['--check', 'src/target.ts']).status, 0);
    assert.deepEqual(fs.existsSync(index) ? fs.readFileSync(index) : null, indexBefore);
});

test('archive, third-party, generated, golden, lockfile and artifact paths are ignored', async t => {
    const root = formattingFixture(t, { 'src/schema.generated.ts': 'const generated=1;const unchanged=2;\n' });
    // The archive-shaped name is a nonexistent synthetic path in this fixture;
    // getFileInfo checks ignore rules without reading any real archive content.
    for (const file of [
        'trash/never-read.ts',
        'node_modules/dep/index.ts',
        'src/vendor/copied.ts',
        'src/third_party/task.js',
        '.agents/skills/example/SKILL.md',
        'auto-imports.d.ts',
        'components.d.ts',
        'src/schema.generated.ts',
        'src/__generated__/schema.ts',
        'tests/analysis/golden/result.json',
        'package-lock.json',
        'docs/codemap/shared.md',
        'docs/CODEMAP.md',
        'test-results/result.ts',
        'artifacts/evals/task.ts',
        'dist/bundle.js',
    ]) {
        const info = await prettier.getFileInfo(path.join(root, file), {
            ignorePath: path.join(root, '.prettierignore'),
        });
        assert.equal(info.ignored, true, file);
    }
    const before = bytes(root, 'src/schema.generated.ts');
    const result = runPrettier(root, ['--write', 'src/schema.generated.ts']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(bytes(root, 'src/schema.generated.ts'), before);
});
