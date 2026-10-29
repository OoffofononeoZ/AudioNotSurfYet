import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { TRANSFER_FORMATS, type DesktopSaveBridge } from '../../src/platform/transferContracts';
import { NativeFileError, nativeResult } from './nativeErrors';
import { requireOwner } from './ownedIpc';
import type { NativeSaves } from './nativeSaves';
import { NativeIpcTasks } from './nativeIpcTasks';

export function registerSaveIpc(
    getWindow: () => BrowserWindow | null,
    origin: string,
    saves: NativeSaves,
    tasks = new NativeIpcTasks(),
) {
    const channels: string[] = [];
    let choosing = false;
    function handler<K extends keyof DesktopSaveBridge>(
        name: K,
        operation: (owner: BrowserWindow, ...args: unknown[]) => Promise<unknown>,
    ) {
        const channel = `audiosurf:saves:${name}`;
        channels.push(channel);
        ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) =>
            nativeResult(() =>
                tasks.run(async () => {
                    const owner = requireOwner(event, getWindow(), origin);
                    return operation(owner, ...args);
                }),
            ),
        );
    }
    handler('beginSave', async (owner, purpose, name, size) => {
        if (
            typeof purpose !== 'string' ||
            !Object.hasOwn(TRANSFER_FORMATS, purpose) ||
            typeof name !== 'string' ||
            !name ||
            name.length > 240 ||
            /[\\/:*?"<>|\x00-\x1f]/.test(name) ||
            name === '.' ||
            name === '..' ||
            typeof size !== 'number' ||
            !Number.isSafeInteger(size) ||
            size < 0 ||
            choosing
        )
            throw new NativeFileError('invalid-request');
        const format = TRANSFER_FORMATS[purpose as keyof typeof TRANSFER_FORMATS];
        const revision = saves.revision,
            frameToken = owner.webContents.mainFrame.frameToken,
            epoch = tasks.revision;
        choosing = true;
        try {
            const result = await dialog.showSaveDialog(owner, {
                title: '保存文件',
                defaultPath: name,
                filters: [
                    {
                        name: format.description,
                        extensions: Object.values(format.accept)
                            .flat()
                            .map(ext => ext.slice(1)),
                    },
                ],
            });
            if (
                result.canceled ||
                !result.filePath ||
                owner.isDestroyed() ||
                owner !== getWindow() ||
                !tasks.current(epoch) ||
                saves.revision !== revision ||
                owner.webContents.mainFrame.frameToken !== frameToken ||
                owner.webContents.mainFrame.origin !== origin
            )
                return null;
            return saves.begin(result.filePath, size);
        } finally {
            choosing = false;
        }
    });
    handler('writeSave', async (_owner, id, chunk) => {
        if (typeof id !== 'string') throw new NativeFileError('invalid-request');
        return saves.write(id, chunk);
    });
    handler('commitSave', async (_owner, id) => {
        if (typeof id !== 'string') throw new NativeFileError('invalid-request');
        return saves.commit(id);
    });
    handler('abortSave', async (_owner, id) => {
        if (typeof id !== 'string') throw new NativeFileError('invalid-request');
        return saves.abort(id);
    });
    return () => {
        for (const channel of channels) ipcMain.removeHandler(channel);
    };
}
