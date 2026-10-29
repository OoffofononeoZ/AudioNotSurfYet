import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { registerFileIpc } from '../../electron/files/fileIpc';
import type { NativeReadGrants } from '../../electron/files/nativeGrants';

const host = vi.hoisted(() => ({
    handlers: new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>(),
    open: vi.fn(),
}));
vi.mock('electron', () => ({
    dialog: { showOpenDialog: host.open },
    ipcMain: {
        handle: (name: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>) =>
            host.handlers.set(name, handler),
        removeHandler: (name: string) => host.handlers.delete(name),
    },
}));
afterEach(() => {
    host.handlers.clear();
    vi.clearAllMocks();
});

const id = 'abcdefff-1234-4123-8123-123456789abc';
function fixture() {
    const frame = { frameToken: 'owner-frame', origin: 'app://audiosurf' };
    const contents = { mainFrame: frame };
    const owner = { webContents: contents, isDestroyed: vi.fn(() => false) };
    const describe = vi.fn(async () => ({ name: 'selected file' }));
    const selectFile = vi.fn(async () => ({ grantId: id, kind: 'file', platform: 'electron', name: 'song.wav' }));
    const cleanup = registerFileIpc(() => owner as unknown as BrowserWindow, 'app://audiosurf', {
        describe,
        selectFile,
    } as unknown as NativeReadGrants);
    const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent;
    const invoke = (name: string, sender = event, ...args: unknown[]) =>
        host.handlers.get(`audiosurf:files:${name}`)!(sender, ...args);
    return { owner, event, describe, selectFile, invoke, cleanup };
}

describe('native file IPC owner boundary', () => {
    it('rejects other windows, child frames and opaque/foreign origins before any file access', async () => {
        const fixtureState = fixture(),
            { event, invoke, describe } = fixtureState;
        for (const forged of [
            { ...event, sender: { mainFrame: event.senderFrame } },
            { ...event, senderFrame: { frameToken: 'child', origin: 'app://audiosurf' } },
            { ...event, senderFrame: { frameToken: 'owner-frame', origin: 'null' } },
            { ...event, senderFrame: { frameToken: 'owner-frame', origin: 'https://untrusted.example' } },
            { ...event, senderFrame: null },
        ]) {
            expect(await invoke('describeFile', forged as IpcMainInvokeEvent, id)).toMatchObject({
                ok: false,
                error: { code: 'permission-denied' },
            });
        }
        expect(describe).not.toHaveBeenCalled();
        expect(await invoke('describeFile', event, id)).toEqual({ ok: true, value: { name: 'selected file' } });
        expect(describe).toHaveBeenCalledWith(id);
        fixtureState.cleanup();
        expect(host.handlers.size).toBe(0);
    });

    it('accepts file paths exclusively from the native chooser and validates renderer options', async () => {
        const { event, owner, invoke, selectFile } = fixture();
        expect(await invoke('chooseAudio', event, 'C:/not-selected.wav')).toMatchObject({
            ok: false,
            error: { code: 'invalid-request' },
        });
        expect(host.open).not.toHaveBeenCalled();
        host.open.mockResolvedValueOnce({ canceled: false, filePaths: ['C:/chosen/song.wav'] });
        expect(await invoke('chooseAudio', event, true)).toMatchObject({ ok: true, value: [{ grantId: id }] });
        expect(selectFile).toHaveBeenCalledWith('C:/chosen/song.wav');
        selectFile.mockClear();
        host.open.mockImplementationOnce(async () => {
            owner.isDestroyed.mockReturnValue(true);
            return { canceled: false, filePaths: ['C:/late/song.wav'] };
        });
        expect(await invoke('chooseAudio', event, false)).toEqual({ ok: true, value: [] });
        expect(selectFile).not.toHaveBeenCalled();
    });
});
