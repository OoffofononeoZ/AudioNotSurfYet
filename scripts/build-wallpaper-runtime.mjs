import { build } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, 'public/wallpaper-runtime');
const relative = path.relative(root, output);
if (relative.startsWith('..') || path.isAbsolute(relative) || relative !== path.join('public', 'wallpaper-runtime'))
    throw new Error('壁纸运行包输出目录无效。');
const temporary = path.join(root, 'node_modules/.cache/wallpaper-runtime');
await mkdir(temporary, { recursive: true });
process.env.TEMP = temporary;
process.env.TMP = temporary;
await build({
    configFile: false,
    root,
    publicDir: false,
    logLevel: 'warn',
    build: {
        outDir: output,
        emptyOutDir: true,
        target: 'chrome100',
        lib: {
            entry: path.join(root, 'src/visualizer/wallpaperEntry.ts'),
            name: 'AudioSurfWallpaper',
            formats: ['iife'],
            fileName: () => 'runtime.js',
        },
        rollupOptions: { output: { inlineDynamicImports: true } },
    },
});
const license = await readFile(path.join(root, 'node_modules/three/LICENSE'), 'utf8');
await writeFile(path.join(output, 'THIRD_PARTY_LICENSES.txt'), `Three.js\n${license}`, 'utf8');
console.log('壁纸运行包已生成：public/wallpaper-runtime');
