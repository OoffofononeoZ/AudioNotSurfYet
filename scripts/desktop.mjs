import fs from 'node:fs/promises';
import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { build, createServer } from 'vite';
import { copyDesktopPublicAssets } from './lib/desktop-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const output = path.join(root, 'artifacts/desktop');
const appRoot = path.join(output, 'app');
const command = process.argv[2] ?? 'build';
if (!['build', 'dev', 'dir', 'package'].includes(command)) throw Error(`Unknown desktop command: ${command}`);
await fs.mkdir(path.join(output, 'build-temp'), { recursive: true });
process.env.TEMP = path.join(output, 'build-temp');
process.env.TMP = process.env.TEMP;

function runNode(file, args = []) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [file, ...args], { cwd: root, stdio: 'inherit', windowsHide: true });
        child.on('error', reject);
        child.on('exit', code => (code === 0 ? resolve() : reject(Error(`${file} exited with ${code}`))));
    });
}

await runNode(require.resolve('typescript/bin/tsc'), ['-p', 'tsconfig.electron.json']);
for (const [index, name] of ['main', 'preload'].entries()) {
    await build({
        configFile: false,
        publicDir: false,
        root,
        build: {
            target: 'node24',
            outDir: path.join(appRoot, 'host'),
            emptyOutDir: index === 0,
            minify: false,
            sourcemap: false,
            lib: { entry: path.join(root, `electron/${name}.ts`), formats: ['cjs'], fileName: () => `${name}.cjs` },
            rollupOptions: { external: ['electron', ...builtinModules, ...builtinModules.map(name => `node:${name}`)] },
        },
    });
}
const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
await fs.writeFile(
    path.join(appRoot, 'package.json'),
    JSON.stringify(
        {
            name: 'audionotsurfyet-desktop',
            productName: 'AudioNotSurfYet',
            version: metadata.version,
            description: 'AudioNotSurfYet 本地音频工作台',
            main: 'host/main.cjs',
            private: true,
        },
        null,
        4,
    ) + '\n',
    'utf8',
);
await fs.copyFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(appRoot, 'THIRD_PARTY_NOTICES.md'));

if (command === 'dev') {
    await runNode(path.join(root, 'tests/processing/prepare-assets.mjs'));
    await runNode(path.join(root, 'scripts/build-wallpaper-runtime.mjs'));
    const server = await createServer({
        root,
        mode: 'desktop',
        server: { host: '127.0.0.1', port: 5174, strictPort: true },
    });
    await server.listen();
    const env = { ...process.env, AUDIOSURF_DESKTOP_DEV_URL: 'http://127.0.0.1:5174/' };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(require('electron'), [appRoot], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    const stop = () => {
        child.kill();
        void server.close();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child.once('exit', async code => {
        await server.close();
        process.exitCode = code ?? 1;
    });
    child.once('error', async error => {
        await server.close();
        console.error(error);
        process.exitCode = 1;
    });
} else {
    await runNode(path.join(root, 'tests/processing/prepare-assets.mjs'));
    await runNode(path.join(root, 'scripts/build-wallpaper-runtime.mjs'));
    await runNode(require.resolve('vue-tsc/bin/vue-tsc.js'), ['-b']);
    await build({
        root,
        mode: 'desktop',
        build: { outDir: path.join(appRoot, 'renderer'), emptyOutDir: true, copyPublicDir: false },
    });
    await copyDesktopPublicAssets(root, path.join(appRoot, 'renderer'));
    if (command !== 'build') {
        const { build: packageApp, Platform, Arch } = await import('electron-builder');
        await packageApp({
            targets: Platform.WINDOWS.createTarget(command === 'dir' ? ['dir'] : ['nsis'], Arch.x64),
            publish: 'never',
            config: {
                appId: 'local.audionotsurfyet.desktop',
                productName: 'AudioNotSurfYet',
                electronVersion: metadata.devDependencies.electron,
                electronDist: path.dirname(require('electron')),
                directories: { app: appRoot, output: path.join(output, 'packages') },
                files: ['host/**', 'renderer/**', 'package.json', 'THIRD_PARTY_NOTICES.md', '!node_modules/**'],
                asar: true,
                npmRebuild: false,
                nsis: { oneClick: true, perMachine: false, deleteAppDataOnUninstall: false },
            },
        });
    }
}
