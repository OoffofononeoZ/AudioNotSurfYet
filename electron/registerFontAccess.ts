import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { requireOwner } from './files/ownedIpc';
import { nativeResult, NativeFileError } from './files/nativeErrors';

export function registerFontAccess(
    getWindow: () => BrowserWindow | null,
    ownerOrigin: string,
    grant: (allowed: boolean) => void,
) {
    const channel = 'audiosurf:fonts:requestAccess';
    ipcMain.handle(channel, (event, ...args: unknown[]) =>
        nativeResult(async () => {
            const owner = getWindow();
            requireOwner(event, owner, ownerOrigin);
            if (args.length || !owner) throw new NativeFileError('invalid-request');
            const token = owner.webContents.mainFrame.frameToken;
            const answer = await dialog.showMessageBox(owner, {
                type: 'question',
                title: '读取本机字体',
                message: '允许读取本机安装的字体列表？',
                buttons: ['允许', '取消'],
                defaultId: 1,
                cancelId: 1,
            });
            const current =
                getWindow() === owner &&
                !owner.isDestroyed() &&
                owner.webContents.mainFrame.frameToken === token &&
                owner.webContents.mainFrame.origin === ownerOrigin;
            const allowed = answer.response === 0 && current;
            if (current) grant(allowed);
            return allowed;
        }),
    );
    return () => ipcMain.removeHandler(channel);
}
