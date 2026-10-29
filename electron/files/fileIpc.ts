import { INPUT_FORMATS } from '../../src/platform/transferContracts';
import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { DesktopFileBridge } from '../../src/platform/fileContracts';
import { nativeResult, NativeFileError } from './nativeErrors';
import { NativeReadGrants, grantId, grantRelativePath } from './nativeGrants';
import { requireOwner } from './ownedIpc';
import { NativeIpcTasks } from './nativeIpcTasks';

export function registerFileIpc(
    getWindow: () => BrowserWindow | null,
    ownerOrigin: string,
    grants: NativeReadGrants,
    tasks = new NativeIpcTasks(),
) {
    const channels: string[] = [];
    function handler<K extends keyof DesktopFileBridge>(
        name: K,
        operation: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>,
    ) {
        const channel = `audiosurf:files:${name}`;
        channels.push(channel);
        ipcMain.handle(channel, (event, ...args: unknown[]) =>
            nativeResult(() =>
                tasks.run(async () => {
                    requireOwner(event, getWindow(), ownerOrigin);
                    return operation(event, ...args);
                }),
            ),
        );
    }

    const lease = (owner: BrowserWindow) => {
        const token = owner.webContents.mainFrame.frameToken,
            epoch = tasks.revision;
        return () =>
            !owner.isDestroyed() &&
            owner === getWindow() &&
            tasks.current(epoch) &&
            owner.webContents.mainFrame.frameToken === token &&
            owner.webContents.mainFrame.origin === ownerOrigin;
    };

    handler('chooseFiles', async (_event, purpose, multiple) => {
        if (typeof purpose !== 'string' || !Object.hasOwn(INPUT_FORMATS, purpose) || typeof multiple !== 'boolean')
            throw new NativeFileError('invalid-request');
        const owner = getWindow()!,
            current = lease(owner);
        const format = INPUT_FORMATS[purpose as keyof typeof INPUT_FORMATS];
        const result = await dialog.showOpenDialog(owner, {
            title: format.description,
            properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
            filters: [
                {
                    name: format.description,
                    extensions: Object.values(format.accept)
                        .flat()
                        .map(ext => ext.slice(1)),
                },
            ],
        });
        if (result.canceled || !current()) return [];
        const references = [];
        try {
            for (const file of result.filePaths) references.push(await grants.selectTransientFile(file));
            if (!current()) {
                for (const reference of references) grants.releaseTransientFile(reference.grantId);
                return [];
            }
            return references;
        } catch (error) {
            for (const reference of references) grants.releaseTransientFile(reference.grantId);
            throw error;
        }
    });
    handler('releaseInput', async (_event, id) => grants.releaseTransientFile(grantId(id)));
    handler('chooseAudio', async (_event, multiple, purpose = 'audio') => {
        if (typeof multiple !== 'boolean' || (purpose !== 'audio' && purpose !== 'osu-audio'))
            throw new NativeFileError('invalid-request');
        const owner = getWindow()!,
            current = lease(owner);
        const result = await dialog.showOpenDialog(owner, {
            title: '选择音频',
            properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
            filters: [
                {
                    name: 'Audio files',
                    extensions: purpose === 'osu-audio' ? ['mp3', 'wav', 'flac', 'ogg', 'm4a'] : ['mp3', 'wav', 'flac'],
                },
            ],
        });
        if (result.canceled || !current()) return [];
        const references = [];
        for (const file of result.filePaths) {
            if (!current()) return [];
            references.push(await grants.selectFile(file));
        }
        return current() ? references : [];
    });
    handler('chooseResourceDirectory', async () => {
        const owner = getWindow()!,
            current = lease(owner);
        const result = await dialog.showOpenDialog(owner, { title: '选择资源库', properties: ['openDirectory'] });
        if (result.canceled || !current() || !result.filePaths[0]) return null;
        const reference = await grants.selectDirectory(result.filePaths[0]);
        return current() ? reference : null;
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
