import { inject, type InjectionKey } from 'vue';
import type { AudioFileAccess, DesktopBridge } from './fileContracts';
import { BrowserAudioFiles } from './webAudioFiles';
import { DesktopAudioFiles } from './desktopAudioFiles';
import type { DirectoryFileAccess } from './directoryFiles';
import { BrowserDirectoryFiles } from './webDirectoryFiles';
import { DesktopDirectoryFiles } from './desktopDirectoryFiles';
import type { FileTransferAccess } from './transferContracts';
import { BrowserFileTransfers } from './webFileTransfers';
import { DesktopFileTransfers } from './desktopFileTransfers';
import type { DirectoryExportAccess } from './bundleContracts';
import { BrowserDirectoryExports } from './webDirectoryExports';
import { DesktopDirectoryExports } from './desktopDirectoryExports';
import { applicationDisplayPages, browserDisplayPages, type DisplayPageAccess } from './displayPages';
import type { LifecycleAccess } from './lifecycleContracts';
import { DesktopLifecycle } from './desktopLifecycle';

export interface PlatformPorts {
    readonly kind: 'web' | 'electron';
    readonly audioFiles: AudioFileAccess;
    readonly directoryFiles: DirectoryFileAccess;
    readonly transfers: FileTransferAccess;
    readonly directoryExports: DirectoryExportAccess;
    readonly displayPages: DisplayPageAccess;
    readonly lifecycle: LifecycleAccess;
}

export function createPlatformPorts(bridge?: DesktopBridge): PlatformPorts {
    if (!bridge)
        return {
            kind: 'web',
            audioFiles: new BrowserAudioFiles(),
            directoryFiles: new BrowserDirectoryFiles(),
            transfers: new BrowserFileTransfers(),
            directoryExports: new BrowserDirectoryExports(),
            displayPages: browserDisplayPages,
            lifecycle: { register: () => () => {} },
        };
    if (
        bridge.platform !== 'electron' ||
        bridge.apiVersion !== 1 ||
        !bridge.files ||
        !bridge.saves ||
        !bridge.bundles ||
        !bridge.lifecycle
    ) {
        throw Error('桌面宿主与应用文件接口不匹配，请重新构建应用。');
    }
    return {
        kind: 'electron',
        audioFiles: new DesktopAudioFiles(bridge.files),
        directoryFiles: new DesktopDirectoryFiles(bridge.files),
        transfers: new DesktopFileTransfers(bridge.files, bridge.saves),
        directoryExports: new DesktopDirectoryExports(bridge.bundles),
        displayPages: applicationDisplayPages,
        lifecycle: new DesktopLifecycle(bridge.lifecycle),
    };
}

export const platformPortsKey: InjectionKey<PlatformPorts> = Symbol('platform-ports');
export function usePlatformPorts(): PlatformPorts {
    const ports = inject(platformPortsKey);
    if (!ports) throw Error('应用平台接口尚未初始化。');
    return ports;
}
