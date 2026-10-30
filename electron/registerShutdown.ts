import { app, dialog, type BrowserWindow, type Session } from 'electron';
import { HostShutdown } from './hostShutdown';
import type { ShutdownChannel } from './shutdownChannel';
import type { NativeIpcTasks } from './files/nativeIpcTasks';
import type { NativeSaves } from './files/nativeSaves';
import type { NativeBundles } from './files/nativeBundles';
import type { NativeReadGrants } from './files/nativeGrants';

export function registerShutdown(
    owner: BrowserWindow,
    channel: ShutdownChannel,
    files: {
        tasks: NativeIpcTasks;
        saves: NativeSaves;
        bundles: NativeBundles;
        grants: NativeReadGrants;
    },
    storage: Session,
) {
    const shutdown = new HostShutdown({
        exchange: (phase, timeout) => channel.request(phase, timeout),
        nativeBusy: () => files.tasks.busy || files.saves.busy || files.bundles.busy,
        confirm: async summary => {
            if (owner.isDestroyed()) return false;
            const answer = await dialog.showMessageBox(owner, {
                type: 'question',
                title: '退出 AudioNotSurfYet',
                message: summary ? '当前仍有未导出修改或未完成工作，确认退出？' : '当前页面未响应，仍要退出？',
                detail: summary
                    ? '退出会取消进行中的任务和未完成的文件保存，保存当前草稿；尚未保存的视频输出将丢弃。'
                    : '无法确认草稿已保存。退出可能丢失内存中的修改，并会终止当前任务。',
                buttons: ['继续工作', '退出'],
                defaultId: 0,
                cancelId: 0,
            });
            return answer.response === 1 && !owner.isDestroyed();
        },
        suspendFiles: () => files.tasks.suspend(),
        resumeFiles: () => files.tasks.resume(),
        cleanupFiles: async () => {
            const results = await Promise.allSettled([
                files.saves.abortAll(),
                files.bundles.abortAll(),
                files.tasks.drain(),
            ]);
            if (results.some(result => result.status === 'rejected')) throw Error('原生文件清理失败。');
            await files.grants.flush();
            files.grants.clearTransientFiles();
        },
        flushStorage: async () => {
            storage.flushStorageData();
        },
        finish: () => {
            owner.destroy();
            app.quit();
        },
        report: async message => {
            if (!owner.isDestroyed())
                await dialog.showMessageBox(owner, {
                    type: 'error',
                    title: '未能退出',
                    message,
                    buttons: ['返回'],
                });
        },
    });
    owner.on('close', event => {
        if (shutdown.completed) return;
        event.preventDefault();
        void shutdown.requestClose();
    });
    const beforeQuit = (event: Electron.Event) => {
        if (owner.isDestroyed() || shutdown.completed) return;
        event.preventDefault();
        void shutdown.requestClose();
    };
    app.on('before-quit', beforeQuit);
    owner.once('closed', () => {
        app.removeListener('before-quit', beforeQuit);
        channel.dispose();
    });
    return shutdown;
}
