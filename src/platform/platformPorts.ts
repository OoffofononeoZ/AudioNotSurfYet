import { inject, type InjectionKey } from 'vue';
import type { AudioFileAccess, DesktopBridge } from './fileContracts';
import { BrowserAudioFiles } from './webAudioFiles';
import { DesktopAudioFiles } from './desktopAudioFiles';
import type { DirectoryFileAccess } from './directoryFiles';
import { BrowserDirectoryFiles } from './webDirectoryFiles';
import { DesktopDirectoryFiles } from './desktopDirectoryFiles';

export interface PlatformPorts {
    readonly kind: 'web' | 'electron';
    readonly audioFiles: AudioFileAccess;
    readonly directoryFiles: DirectoryFileAccess;
}

export function createPlatformPorts(bridge?: DesktopBridge): PlatformPorts {
    if (!bridge)
        return { kind: 'web', audioFiles: new BrowserAudioFiles(), directoryFiles: new BrowserDirectoryFiles() };
    if (bridge.platform !== 'electron' || bridge.apiVersion !== 1 || !bridge.files) {
        throw Error('桌面宿主与应用文件接口不匹配，请重新构建应用。');
    }
    return {
        kind: 'electron',
        audioFiles: new DesktopAudioFiles(bridge.files),
        directoryFiles: new DesktopDirectoryFiles(bridge.files),
    };
}

export const platformPortsKey: InjectionKey<PlatformPorts> = Symbol('platform-ports');
export function usePlatformPorts(): PlatformPorts {
    const ports = inject(platformPortsKey);
    if (!ports) throw Error('应用平台接口尚未初始化。');
    return ports;
}
