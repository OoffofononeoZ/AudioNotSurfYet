import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from '../src/platform/fileContracts';
import { SAVE_CHUNK_BYTES } from '../src/platform/transferContracts';
import { isCloseRequest } from '../src/platform/lifecycleContracts';

if (process.isMainFrame) {
    const bridge: DesktopBridge = {
        platform: 'electron',
        apiVersion: 1,
        lifecycle: {
            onRequest: listener => {
                const receive = (_event: unknown, request: unknown) => {
                    if (isCloseRequest(request)) listener(request);
                };
                ipcRenderer.on('audiosurf:lifecycle:request', receive);
                return () => {
                    ipcRenderer.removeListener('audiosurf:lifecycle:request', receive);
                };
            },
            ready: () => ipcRenderer.invoke('audiosurf:lifecycle:ready'),
            reply: (id, reply) => ipcRenderer.invoke('audiosurf:lifecycle:reply', id, reply),
        },
        bundles: {
            beginPreset: (id, name, entries) => ipcRenderer.invoke('audiosurf:bundles:beginPreset', id, name, entries),
            beginWallpaper: entries => ipcRenderer.invoke('audiosurf:bundles:beginWallpaper', entries),
            beginFile: id => ipcRenderer.invoke('audiosurf:bundles:beginFile', id),
            writeFile: (id, chunk) => {
                if (!(chunk instanceof Uint8Array) || chunk.byteLength < 1 || chunk.byteLength > SAVE_CHUNK_BYTES)
                    throw Error('保存数据块无效。');
                return ipcRenderer.invoke('audiosurf:bundles:writeFile', id, chunk);
            },
            closeFile: id => ipcRenderer.invoke('audiosurf:bundles:closeFile', id),
            commit: id => ipcRenderer.invoke('audiosurf:bundles:commit', id),
            abort: id => ipcRenderer.invoke('audiosurf:bundles:abort', id),
        },
        saves: {
            beginSave: (purpose, name, size) => ipcRenderer.invoke('audiosurf:saves:beginSave', purpose, name, size),
            writeSave: (id, chunk) => {
                if (!(chunk instanceof Uint8Array) || chunk.byteLength < 1 || chunk.byteLength > SAVE_CHUNK_BYTES)
                    throw Error('保存数据块无效。');
                return ipcRenderer.invoke('audiosurf:saves:writeSave', id, chunk);
            },
            commitSave: id => ipcRenderer.invoke('audiosurf:saves:commitSave', id),
            abortSave: id => ipcRenderer.invoke('audiosurf:saves:abortSave', id),
        },
        files: {
            chooseFiles: (purpose, multiple) => ipcRenderer.invoke('audiosurf:files:chooseFiles', purpose, multiple),
            releaseInput: id => ipcRenderer.invoke('audiosurf:files:releaseInput', id),
            chooseAudio: (multiple, purpose) => ipcRenderer.invoke('audiosurf:files:chooseAudio', multiple, purpose),
            chooseResourceDirectory: () => ipcRenderer.invoke('audiosurf:files:chooseResourceDirectory'),
            describeFile: id => ipcRenderer.invoke('audiosurf:files:describeFile', id),
            filePermission: id => ipcRenderer.invoke('audiosurf:files:filePermission', id),
            listDirectory: (id, relative) => ipcRenderer.invoke('audiosurf:files:listDirectory', id, relative),
            describeDirectoryFile: (id, relative) =>
                ipcRenderer.invoke('audiosurf:files:describeDirectoryFile', id, relative),
        },
    };
    contextBridge.exposeInMainWorld('audiosurfDesktop', bridge);
}
