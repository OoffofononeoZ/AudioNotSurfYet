import { build } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { visualizerSkillPath } from './lib/visualizer-skill-path.mjs';
const root = path.resolve(import.meta.dirname, '..');
const file = path.join(visualizerSkillPath(), 'scripts/lib/resource-codec.generated.mjs');
const result = await build({
    configFile: false,
    root,
    publicDir: false,
    logLevel: 'silent',
    build: {
        write: false,
        minify: false,
        target: 'esnext',
        lib: {
            entry: path.join(root, 'src/visualizer/resourceCodec.ts'),
            formats: ['es'],
            fileName: () => 'resource-codec.generated.mjs',
        },
        rollupOptions: { output: { exports: 'named' } },
    },
});
const output = (Array.isArray(result) ? result : [result])
    .flatMap(r => ('output' in r ? r.output : []))
    .find(c => c.type === 'chunk');
if (!output) throw Error('未生成资源 codec。');
const text =
    '// Generated from AudioSurf resourceCodec.ts by sync-visualizer-skill-codec.mjs. Do not edit.\n' + output.code;
if (process.argv.includes('--check')) {
    if ((await fs.readFile(file, 'utf8')) !== text) throw Error('外部 skill codec 已过期。');
} else await fs.writeFile(file, text, 'utf8');
console.log('External Visualizer codec ' + (process.argv.includes('--check') ? 'checked' : 'synchronized'));
