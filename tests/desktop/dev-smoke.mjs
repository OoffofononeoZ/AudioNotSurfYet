import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { createNativeRun } from '../../scripts/lib/desktop-native-runtime.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('development-check');
const output = path.join(root, 'artifacts/desktop/capabilities', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(process.execPath, ['scripts/desktop.mjs', 'dev', '--inspect-browser'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
});
let log = '';
let resolveDebugger;
let rejectDebugger;
const debuggerReady = new Promise((resolve, reject) => {
    resolveDebugger = resolve;
    rejectDebugger = reject;
});
function receive(chunk) {
    log += chunk;
    const match = log.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/);
    if (match) resolveDebugger(match[1]);
}
child.stdout.setEncoding('utf8').on('data', receive);
child.stderr.setEncoding('utf8').on('data', receive);
const exited = new Promise(resolve => {
    child.once('exit', (code, signal) => {
        rejectDebugger(Error(`Development command exited before inspector: ${code ?? signal}`));
        resolve({ code, signal });
    });
    child.once('error', error => {
        rejectDebugger(error);
        resolve({ error: String(error) });
    });
});

async function deadline(promise, label) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(
                    () => reject(Error(`${label}; owned development PID ${child.pid} may still be live`)),
                    60_000,
                );
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

const result = { pid: child.pid, nativeDirectory: native.directory, status: 'running' };
let browser;
try {
    const endpoint = await deadline(debuggerReady, 'Development inspector did not become ready');
    browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.waitForEvent('page'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#main-layout');
    const bridge = await page.evaluate(() => ({
        origin: location.origin,
        platform: window.audiosurfDesktop?.platform,
        require: typeof window.require,
        process: typeof window.process,
    }));
    assert.deepEqual(bridge, {
        origin: 'http://127.0.0.1:5174',
        platform: 'electron',
        require: 'undefined',
        process: 'undefined',
    });
    await page.goto('http://127.0.0.1:5174/editor');
    await page.waitForSelector('#main-layout');
    assert.deepEqual(errors, []);
    result.bridge = bridge;
    await page.evaluate(() => {
        setTimeout(() => window.close(), 0);
    });
    const terminal = await deadline(exited, 'Development application did not close');
    assert.equal(terminal.code, 0, 'Development command cleanup failed');
    const match = log.match(/Desktop development runtime: ([^\r\n]+)/);
    assert(match, 'Native development execution directory missing');
    const remaining = await fs.readdir(match[1]);
    assert(!remaining.includes('electron'), 'Owned development executable copy was not cleaned');
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = String(error);
    process.exitCode = 1;
    console.error(error);
} finally {
    if (browser?.isConnected() && child.exitCode === null) {
        const page = browser
            .contexts()[0]
            ?.pages()
            .find(page => page.url().startsWith('http://127.0.0.1:5174/'));
        if (page && !page.isClosed()) {
            try {
                await page.evaluate(() => {
                    setTimeout(() => window.close(), 0);
                });
                await deadline(exited, 'Development command remains live after normal close');
            } catch (error) {
                result.cleanupError = String(error);
                result.status = 'failed';
                process.exitCode = 1;
            }
        }
    }
    await browser?.close();
    await fs.writeFile(path.join(output, 'development.log'), log, 'utf8');
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 4) + '\n', 'utf8');
    console.log(JSON.stringify(result, null, 2));
    // On a failed observation retain a still-live owned command for diagnosis;
    // do not infer termination or blindly restart/kill its process tree.
}
