import { contextBridge } from 'electron';

if (process.isMainFrame) {
    contextBridge.exposeInMainWorld('audiosurfDesktop', { platform: 'electron', apiVersion: 1 });
}
