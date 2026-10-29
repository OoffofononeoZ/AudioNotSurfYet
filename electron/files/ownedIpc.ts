import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { NativeFileError } from './nativeErrors';

export function requireOwner(event: IpcMainInvokeEvent, owner: BrowserWindow | null, origin: string) {
    const frame = event.senderFrame;
    if (
        !owner ||
        owner.isDestroyed() ||
        event.sender !== owner.webContents ||
        !frame ||
        frame.frameToken !== owner.webContents.mainFrame.frameToken ||
        frame.origin !== origin
    )
        throw new NativeFileError('permission-denied');
    return owner;
}
