import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { DesktopFileBridge } from '../../src/platform/fileContracts';
import { nativeResult, NativeFileError } from './nativeErrors';
import { NativeReadGrants, grantId, grantRelativePath } from './nativeGrants';

export function registerFileIpc(getWindow: () => BrowserWindow | null, ownerOrigin: string, grants: NativeReadGrants) {
    const channels: string[] = [];
    function handler<K extends keyof DesktopFileBridge>(
        name: K,
        operation: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>,
    ) {
        const channel = `audiosurf:files:${name}`;
        channels.push(channel);
        ipcMain.handle(channel, (event, ...args: unknown[]) =>
            nativeResult(async () => {
                const owner = getWindow(),
                    frame = event.senderFrame;
                if (
                    !owner ||
                    owner.isDestroyed() ||
                    event.sender !== owner.webContents ||
                    !frame ||
                    frame.frameToken !== owner.webContents.mainFrame.frameToken ||
                    frame.origin !== ownerOrigin
                ) {
                    throw new NativeFileError('permission-denied');
                }
                return operation(event, ...args);
            }),
        );
    }

    handler('chooseAudio', async (_event, multiple) => {
        if (typeof multiple !== 'boolean') throw new NativeFileError('invalid-request');
        const owner = getWindow()!;
        const result = await dialog.showOpenDialog(owner, {
            title: '选择音频',
            properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
            filters: [{ name: 'Audio files', extensions: ['mp3', 'wav', 'flac'] }],
        });
        if (result.canceled || owner.isDestroyed()) return [];
        const references = [];
        for (const file of result.filePaths) references.push(await grants.selectFile(file));
        return references;
    });
    handler('chooseResourceDirectory', async () => {
        const owner = getWindow()!;
        const result = await dialog.showOpenDialog(owner, { title: '选择资源库', properties: ['openDirectory'] });
        return result.canceled || owner.isDestroyed() || !result.filePaths[0]
            ? null
            : grants.selectDirectory(result.filePaths[0]);
    });
    handler('describeFile', async (_event, id) => grants.describe(grantId(id)));
    handler('filePermission', async (_event, id) => grants.permission(grantId(id)));
    handler('listDirectory', async (_event, id, relative) => grants.list(grantId(id), grantRelativePath(relative)));
    handler('describeDirectoryFile', async (_event, id, relative) =>
        grants.directoryFile(grantId(id), grantRelativePath(relative)),
    );
    return () => {
        for (const channel of channels) ipcMain.removeHandler(channel);
    };
}
