import fs from 'node:fs/promises';
import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { build, createServer } from 'vite';
import { copyDesktopPublicAssets } from './lib/desktop-assets.mjs';
import { desktopPackageConfig, writePackageChecksums } from './lib/desktop-package.mjs';
import { createNativeRun, copyNativeTree, cleanupNativeTree } from './lib/desktop-native-runtime.mjs';

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
    const native = await createNativeRun('development');
    const runtime = await copyNativeTree(path.dirname(require('electron')), path.join(native.directory, 'electron'));
    const server = await createServer({
        root,
        mode: 'desktop',
        server: { host: '127.0.0.1', port: 5174, strictPort: true },
    });
    try {
        await server.listen();
    } catch (error) {
        await cleanupNativeTree(runtime);
        throw error;
    }
    const env = {
        ...process.env,
        TEMP: native.temp,
        TMP: native.temp,
        AUDIOSURF_DESKTOP_DEV_URL: 'http://127.0.0.1:5174/',
    };
    delete env.ELECTRON_RUN_AS_NODE;
    console.log(`Desktop development runtime: ${native.directory}`);
    const inspectBrowser = process.argv.includes('--inspect-browser');
    const electronArgs = [
        ...(inspectBrowser ? ['--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1'] : []),
        appRoot,
    ];
    const child = spawn(path.join(runtime.root, 'electron.exe'), electronArgs, {
        cwd: root,
        env,
        stdio: 'inherit',
        windowsHide: true,
    });
    const stop = () => {
        child.kill();
        void server.close();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    let finishing;
    function finish(code, error) {
        finishing ??= (async () => {
            process.removeListener('SIGINT', stop);
            process.removeListener('SIGTERM', stop);
            await server.close();
            await cleanupNativeTree(runtime);
            if (error) console.error(error);
            process.exitCode = code ?? 1;
        })().catch(failure => {
            console.error(failure);
            process.exitCode = 1;
        });
    }
    child.once('exit', code => finish(code));
    child.once('error', error => finish(1, error));
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
        const packageArtifacts = await packageApp({
            targets: Platform.WINDOWS.createTarget(command === 'dir' ? ['dir'] : ['nsis'], Arch.x64),
            publish: 'never',
            config: desktopPackageConfig(root, metadata, appRoot, path.join(output, 'packages')),
        });
        await writePackageChecksums(packageArtifacts);
    }
}
