import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { expect } from '@playwright/test';
import { installDialogFixture } from './dialog-fixture.mjs';

export async function installRecoveryDialogs(app) {
    await installDialogFixture(app);
    await app.evaluate(({ dialog }) => {
        const original = dialog.showMessageBox;
        globalThis.__recoveryWarnings = [];
        dialog.showMessageBox = async (owner, options) => {
            if (options.title === '有未清理的临时文件') {
                globalThis.__recoveryWarnings.push({
                    title: options.title,
                    message: options.message,
                    detail: options.detail,
                });
                return { response: 0, checkboxChecked: false };
            }
            return original(owner, options);
        };
    });
}

/** Kill only the connected test app's actual main tree, never the launcher or a process-name match. */
export async function terminateRecoveryApp(app, executable) {
    const launcher = app.process();
    const owned = await app.evaluate(({ app }) => ({
        path: process.execPath,
        pid: process.pid,
        children: app.getAppMetrics().map(entry => entry.pid),
    }));
    assert.equal(owned.path, executable);
    assert(owned.children.includes(owned.pid), 'Connected main process must belong to its own metrics tree');
    const killed = spawnSync('taskkill.exe', ['/PID', String(owned.pid), '/T', '/F'], {
        windowsHide: true,
        encoding: 'utf8',
        timeout: 30000,
    });
    assert.equal(killed.status, 0, killed.stdout + killed.stderr);
    await expect
        .poll(
            () =>
                owned.children.filter(pid => {
                    try {
                        process.kill(pid, 0);
                        return true;
                    } catch (error) {
                        if (error.code === 'ESRCH') return false;
                        throw error;
                    }
                }),
            { timeout: 30000 },
        )
        .toEqual([]);
    await expect.poll(() => launcher.exitCode ?? launcher.signalCode, { timeout: 30000 }).not.toBe(null);
    return {
        hard: true,
        mainPid: owned.pid,
        launcherPid: launcher.pid,
        ownedPids: owned.children,
        code: launcher.exitCode,
        signal: launcher.signalCode,
    };
}
