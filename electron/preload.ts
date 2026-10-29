import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from '../src/platform/fileContracts';

if (process.isMainFrame) {
    const bridge: DesktopBridge = {
        platform: 'electron',
        apiVersion: 1,
        files: {
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
