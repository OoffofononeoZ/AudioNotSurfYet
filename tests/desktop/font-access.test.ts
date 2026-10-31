import { afterEach, expect, test, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { registerFontAccess } from '../../electron/registerFontAccess';
const host = vi.hoisted(() => ({
    handlers: new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>(),
    confirm: vi.fn(),
}));
vi.mock('electron', () => ({
    dialog: { showMessageBox: host.confirm },
    ipcMain: {
        handle: (name: string, handler: (e: unknown, ...args: unknown[]) => Promise<unknown>) =>
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
        contents = { mainFrame: frame },
        owner = { webContents: contents, isDestroyed: () => false };
    const grant = vi.fn(),
        cleanup = registerFontAccess(() => owner as unknown as BrowserWindow, 'app://audiosurf', grant);
    const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent;
    return {
        frame,
        event,
        grant,
        cleanup,
        invoke: (sender: unknown = event, ...args: unknown[]) =>
            host.handlers.get('audiosurf:fonts:requestAccess')!(sender, ...args),
    };
}
test('font IPC denies foreign frames, origins and unexpected arguments without prompting', async () => {
    const f = fixture();
    for (const event of [
        { ...f.event, sender: {} },
        { ...f.event, senderFrame: { frameToken: 'other', origin: 'app://audiosurf' } },
        { ...f.event, senderFrame: { frameToken: 'owner', origin: 'https://external.invalid' } },
    ])
        expect(await f.invoke(event)).toMatchObject({ ok: false, error: { code: 'permission-denied' } });
    expect(await f.invoke(f.event, 'extra')).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(host.confirm).not.toHaveBeenCalled();
    expect(f.grant).not.toHaveBeenCalled();
    f.cleanup();
    expect(host.handlers.size).toBe(0);
});
test('font permission is granted only by confirmation in the current owner frame', async () => {
    const f = fixture();
    host.confirm.mockResolvedValueOnce({ response: 1 });
    expect(await f.invoke()).toEqual({ ok: true, value: false });
    expect(f.grant).toHaveBeenLastCalledWith(false);
    host.confirm.mockResolvedValueOnce({ response: 0 });
    expect(await f.invoke()).toEqual({ ok: true, value: true });
    expect(f.grant).toHaveBeenLastCalledWith(true);
    let finish!: (value: { response: number }) => void;
    host.confirm.mockImplementationOnce(() => new Promise(resolve => (finish = resolve)));
    const pending = f.invoke();
    f.frame.frameToken = 'navigated';
    finish({ response: 0 });
    expect(await pending).toEqual({ ok: true, value: false });
    expect(f.grant).toHaveBeenCalledTimes(2);
});
