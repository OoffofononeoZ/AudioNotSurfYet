import { afterEach, expect, test, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { registerBundleIpc } from '../../electron/files/bundleIpc';
import type { NativeBundles } from '../../electron/files/nativeBundles';
import type { NativeReadGrants } from '../../electron/files/nativeGrants';
const host = vi.hoisted(() => ({
    handlers: new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>(),
    open: vi.fn(),
    confirm: vi.fn(),
}));
vi.mock('electron', () => ({
    dialog: { showOpenDialog: host.open, showMessageBox: host.confirm },
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
const id = '00000000-0000-4000-8000-000000000001';
const preset = [
    { name: 'source/resource.json', size: 2 },
    { name: 'resource-package.json', size: 2 },
    { name: 'preview.png', size: 3 },
    { name: 'resource-info.json', size: 2 },
];
const wallpaper = ['index.html', 'style-data.js', 'runtime.js', 'THIRD_PARTY_LICENSES.txt', 'project.json'].map(
    name => ({ name, size: 2 }),
);
function fixture() {
    const frame = { frameToken: 'owner', origin: 'app://audiosurf' },
        contents = { mainFrame: frame },
        owner = { webContents: contents, isDestroyed: vi.fn(() => false) };
    const bundles = {
        revision: 0,
        begin: vi.fn(async () => ({ bundleId: id, folderName: 'new' })),
        beginFile: vi.fn(),
        writeFile: vi.fn(),
        closeFile: vi.fn(),
        commit: vi.fn(),
        abort: vi.fn(),
    };
    const grants = { resolveDirectory: vi.fn(async () => 'C:/chosen/library/presets') };
    const cleanup = registerBundleIpc(
        () => owner as unknown as BrowserWindow,
        'app://audiosurf',
        grants as unknown as NativeReadGrants,
        bundles as unknown as NativeBundles,
    );
    const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent;
    const invoke = (name: string, sender = event, ...args: unknown[]) =>
        host.handlers.get(`audiosurf:bundles:${name}`)!(sender, ...args);
    return { frame, owner, event, invoke, bundles, grants, cleanup };
}
test('rejects other frames and unsafe manifests before any directory choice or writing', async () => {
    const s = fixture();
    expect(
        await s.invoke(
            'beginWallpaper',
            { ...s.event, senderFrame: { frameToken: 'child', origin: 'app://audiosurf' } } as IpcMainInvokeEvent,
            wallpaper,
        ),
    ).toMatchObject({ ok: false, error: { code: 'permission-denied' } });
    expect(await s.invoke('beginWallpaper', s.event, [{ name: '../outside', size: 2 }])).toMatchObject({
        ok: false,
        error: { code: 'invalid-request' },
    });
    expect(host.open).not.toHaveBeenCalled();
    expect(s.bundles.begin).not.toHaveBeenCalled();
    s.cleanup();
    expect(host.handlers.size).toBe(0);
});
test('preset writes require a selected library and a positive native confirmation', async () => {
    const s = fixture();
    host.confirm.mockResolvedValueOnce({ response: 1 });
    expect(await s.invoke('beginPreset', s.event, id, 'user-preset-123', preset)).toEqual({ ok: true, value: null });
    expect(s.bundles.begin).not.toHaveBeenCalled();
    host.confirm.mockResolvedValueOnce({ response: 0 });
    expect(await s.invoke('beginPreset', s.event, id, 'user-preset-123', preset)).toMatchObject({
        ok: true,
        value: { bundleId: id },
    });
    expect(s.grants.resolveDirectory).toHaveBeenCalledWith(id, 'presets');
    expect(s.bundles.begin).toHaveBeenCalledWith('C:/chosen/library/presets', 'user-preset-123', 'preset', preset);
});
test('wallpaper destination comes only from the native chooser and late dialogs cannot create output', async () => {
    const s = fixture();
    host.open.mockResolvedValueOnce({ canceled: false, filePaths: ['C:/chosen/output'] });
    expect(await s.invoke('beginWallpaper', s.event, wallpaper)).toMatchObject({ ok: true, value: { bundleId: id } });
    expect(s.bundles.begin).toHaveBeenCalledWith(
        'C:/chosen/output',
        expect.stringMatching(/^audiosurf-/),
        'wallpaper',
        wallpaper,
    );
    s.bundles.begin.mockClear();
    host.open.mockImplementationOnce(async () => {
        ++s.bundles.revision;
        return { canceled: false, filePaths: ['C:/late'] };
    });
    expect(await s.invoke('beginWallpaper', s.event, wallpaper)).toEqual({ ok: true, value: null });
    expect(s.bundles.begin).not.toHaveBeenCalled();
});
