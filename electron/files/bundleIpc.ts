import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { DesktopBundleBridge } from '../../src/platform/bundleContracts';
import { nativeResult, NativeFileError } from './nativeErrors';
import { requireOwner } from './ownedIpc';
import { NativeReadGrants, grantId } from './nativeGrants';
import { NativeBundles } from './nativeBundles';
import { bundleEntries } from './bundlePaths';
import { NativeIpcTasks } from './nativeIpcTasks';

export function registerBundleIpc(
    getWindow: () => BrowserWindow | null,
    origin: string,
    grants: NativeReadGrants,
    bundles: NativeBundles,
    tasks = new NativeIpcTasks(),
) {
    const channels: string[] = [];
    let choosing = false;
    function handler<K extends keyof DesktopBundleBridge>(
        name: K,
        operation: (owner: BrowserWindow, ...args: unknown[]) => Promise<unknown>,
    ) {
        const channel = `audiosurf:bundles:${name}`;
        channels.push(channel);
        ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) =>
            nativeResult(() =>
                tasks.run(() => operation(requireOwner(event, getWindow(), origin), ...args), name === 'abort'),
            ),
        );
    }
    const lease = (owner: BrowserWindow) => {
        const token = owner.webContents.mainFrame.frameToken,
            revision = bundles.revision,
            epoch = tasks.revision;
        return () =>
            !owner.isDestroyed() &&
            owner === getWindow() &&
            owner.webContents.mainFrame.frameToken === token &&
            owner.webContents.mainFrame.origin === origin &&
            tasks.current(epoch) &&
            bundles.revision === revision;
    };
    handler('beginPreset', async (owner, id, name, input) => {
        if (choosing || typeof name !== 'string' || !/^user-preset-[a-f0-9-]{1,64}$/.test(name))
            throw new NativeFileError('invalid-request');
        const entries = bundleEntries('preset', input),
            current = lease(owner),
            parent = await grants.resolveDirectory(grantId(id), 'presets');
        if (!current()) return null;
        if (choosing) throw new NativeFileError('invalid-request');
        choosing = true;
        try {
            const answer = await dialog.showMessageBox(owner, {
                type: 'question',
                title: '保存预设',
                message: `将预设保存到资源库「${path.basename(path.dirname(parent))}」？`,
                detail: `仅创建 presets/${name}，已有资源保持不变。`,
                buttons: ['保存', '取消'],
                defaultId: 0,
                cancelId: 1,
            });
            if (answer.response !== 0 || !current()) return null;
            if ((await grants.resolveDirectory(grantId(id), 'presets')) !== parent)
                throw new NativeFileError('permission-denied');
            return bundles.begin(parent, name, 'preset', entries);
        } finally {
            choosing = false;
        }
    });
    handler('beginWallpaper', async (owner, input) => {
        if (choosing) throw new NativeFileError('invalid-request');
        const entries = bundleEntries('wallpaper', input),
            current = lease(owner);
        choosing = true;
        try {
            const result = await dialog.showOpenDialog(owner, {
                title: '选择壁纸导出位置',
                properties: ['openDirectory'],
            });
            if (result.canceled || !result.filePaths[0] || !current()) return null;
            return bundles.begin(result.filePaths[0], 'audiosurf-' + randomUUID(), 'wallpaper', entries);
        } finally {
            choosing = false;
        }
    });
    handler('beginFile', async (_owner, id) => bundles.beginFile(grantId(id)));
    handler('writeFile', async (_owner, id, chunk) => bundles.writeFile(grantId(id), chunk));
    handler('closeFile', async (_owner, id) => bundles.closeFile(grantId(id)));
    handler('commit', async (_owner, id) => bundles.commit(grantId(id)));
    handler('abort', async (_owner, id) => bundles.abort(grantId(id)));
    return () => {
        for (const channel of channels) ipcMain.removeHandler(channel);
    };
}
