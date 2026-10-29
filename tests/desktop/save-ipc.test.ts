import { afterEach, expect, test, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { registerSaveIpc } from '../../electron/files/saveIpc';
import type { NativeSaves } from '../../electron/files/nativeSaves';
const host = vi.hoisted(() => ({
    handlers: new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>(),
    save: vi.fn(),
}));
vi.mock('electron', () => ({
    dialog: { showSaveDialog: host.save },
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
function fixture() {
    const frame = { frameToken: 'owner', origin: 'app://audiosurf' },
        contents = { mainFrame: frame };
    const owner = { webContents: contents, isDestroyed: vi.fn(() => false) };
    const saves = {
        revision: 0,
        begin: vi.fn(async () => ({ saveId: 'opaque', name: 'project.json' })),
        write: vi.fn(),
        commit: vi.fn(),
        abort: vi.fn(),
    };
    const cleanup = registerSaveIpc(
        () => owner as unknown as BrowserWindow,
        'app://audiosurf',
        saves as unknown as NativeSaves,
    );
    const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent;
    const invoke = (name: string, sender = event, ...args: unknown[]) =>
        host.handlers.get(`audiosurf:saves:${name}`)!(sender, ...args);
    return { owner, frame, saves, event, invoke, cleanup };
}
test('save IPC denies foreign windows, child frames and origins before opening a dialog or writing', async () => {
    const s = fixture();
    for (const event of [
        { ...s.event, sender: {} },
        { ...s.event, senderFrame: { frameToken: 'child', origin: 'app://audiosurf' } },
        { ...s.event, senderFrame: { frameToken: 'owner', origin: 'null' } },
    ])
        expect(await s.invoke('writeSave', event as IpcMainInvokeEvent, 'opaque', new Uint8Array([1]))).toMatchObject({
            ok: false,
            error: { code: 'permission-denied' },
        });
    expect(s.saves.write).not.toHaveBeenCalled();
    expect(host.save).not.toHaveBeenCalled();
    s.cleanup();
    expect(host.handlers.size).toBe(0);
});
test('save choices accept a purpose and basename, while the path comes exclusively from the native dialog', async () => {
    const s = fixture();
    for (const name of ['C:/outside.json', '../outside.json', 'bad\u0000.json'])
        expect(await s.invoke('beginSave', s.event, 'editor-project', name, 2)).toMatchObject({ ok: false });
    expect(await s.invoke('beginSave', s.event, '__proto__', 'project.json', 2)).toMatchObject({ ok: false });
    expect(host.save).not.toHaveBeenCalled();
    host.save.mockResolvedValueOnce({ canceled: false, filePath: 'C:/chosen/project.json' });
    expect(await s.invoke('beginSave', s.event, 'editor-project', 'project.json', 2)).toMatchObject({
        ok: true,
        value: { saveId: 'opaque' },
    });
    expect(s.saves.begin).toHaveBeenCalledWith('C:/chosen/project.json', 2);
    expect(host.save).toHaveBeenCalledWith(
        s.owner,
        expect.objectContaining({
            defaultPath: 'project.json',
            filters: [{ name: 'AudioNotSurfYet Editor JSON', extensions: ['json'] }],
        }),
    );
});
test('a cancelled dialog or navigation while it was open never creates a stale save transaction', async () => {
    const s = fixture();
    host.save.mockResolvedValueOnce({ canceled: true });
    expect(await s.invoke('beginSave', s.event, 'video', 'video.webm', 100)).toEqual({ ok: true, value: null });
    host.save.mockImplementationOnce(async () => {
        ++s.saves.revision;
        return { canceled: false, filePath: 'C:/late.webm' };
    });
    expect(await s.invoke('beginSave', s.event, 'video', 'video.webm', 100)).toEqual({ ok: true, value: null });
    host.save.mockImplementationOnce(async () => {
        s.frame.frameToken = 'new-page';
        return { canceled: false, filePath: 'C:/late.webm' };
    });
    expect(await s.invoke('beginSave', s.event, 'video', 'video.webm', 100)).toEqual({ ok: true, value: null });
    expect(s.saves.begin).not.toHaveBeenCalled();
});
