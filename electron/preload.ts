import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from '../src/platform/fileContracts';
import { SAVE_CHUNK_BYTES } from '../src/platform/transferContracts';

if (process.isMainFrame) {
    const bridge: DesktopBridge = {
        platform: 'electron',
        apiVersion: 1,
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
            chooseProject: purpose => ipcRenderer.invoke('audiosurf:files:chooseProject', purpose),
            releaseProject: id => ipcRenderer.invoke('audiosurf:files:releaseProject', id),
            chooseAudio: multiple => ipcRenderer.invoke('audiosurf:files:chooseAudio', multiple),
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
