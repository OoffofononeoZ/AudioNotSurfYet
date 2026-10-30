import { afterEach, expect, test, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { ShutdownChannel } from '../../electron/shutdownChannel';
const host = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => Promise<unknown>>() }));
vi.mock('electron', () => ({
    ipcMain: {
        handle: (name: string, handler: (...args: any[]) => Promise<unknown>) => host.handlers.set(name, handler),
        removeHandler: (name: string) => host.handlers.delete(name),
    },
}));
let channel: ShutdownChannel;
afterEach(() => {
    channel?.dispose();
    host.handlers.clear();
    vi.useRealTimers();
});
function fixture() {
    const frame = { frameToken: 'owner', origin: 'app://audiosurf' };
    const contents = { mainFrame: frame, send: vi.fn() };
    const owner = { webContents: contents, isDestroyed: () => false };
    const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent;
    channel = new ShutdownChannel(() => owner as unknown as BrowserWindow, frame.origin);
    const invoke = (name: string, sender = event, ...args: unknown[]) =>
        host.handlers.get(`audiosurf:lifecycle:${name}`)!(sender, ...args);
    return { contents, event, invoke };
}
test('only the registered owner frame can acknowledge a shutdown request with a valid response', async () => {
    const s = fixture();
    const foreign = {
        ...s.event,
        senderFrame: { frameToken: 'child', origin: 'app://audiosurf' },
    } as unknown as IpcMainInvokeEvent;
    expect(await s.invoke('ready', foreign)).toMatchObject({ ok: false, error: { code: 'permission-denied' } });
    expect(channel.ready).toBe(false);
    expect(await s.invoke('ready')).toEqual({ ok: true, value: undefined });
    const pending = channel.request('inspect');
    const request = s.contents.send.mock.calls[0]![1];
    expect(await s.invoke('reply', foreign, request.id, { ok: true })).toMatchObject({ ok: false });
    expect(await s.invoke('reply', s.event, request.id, { ok: true, summary: { unsaved: 'yes' } })).toMatchObject({
        ok: false,
        error: { code: 'invalid-request' },
    });
    const reply = { ok: true, summary: { unsaved: true, tasks: false, output: true } };
    expect(await s.invoke('reply', s.event, request.id, reply)).toEqual({ ok: true, value: undefined });
    expect(await pending).toEqual(reply);
    expect(await s.invoke('reply', s.event, request.id, reply)).toMatchObject({
        ok: false,
        error: { code: 'invalid-request' },
    });
});
test('navigation or a new registration invalidates an older pending request', async () => {
    const s = fixture();
    await s.invoke('ready');
    const pending = channel.request('prepare');
    const failure = expect(pending).rejects.toThrow('失效');
    const id = s.contents.send.mock.calls[0]![1].id;
    await s.invoke('ready');
    await failure;
    expect(await s.invoke('reply', s.event, id, { ok: true })).toMatchObject({ ok: false });
    const next = channel.request('prepare');
    const nextFailure = expect(next).rejects.toThrow('失效');
    channel.invalidate();
    await nextFailure;
    expect(channel.ready).toBe(false);
});
test('inspect timeout expires only its own request and permits a later attempt', async () => {
    vi.useFakeTimers();
    const s = fixture();
    await s.invoke('ready');
    const expired = expect(channel.request('inspect', 5000)).rejects.toThrow('没有响应');
    await vi.advanceTimersByTimeAsync(5000);
    await expired;
    const next = channel.request('prepare');
    const id = s.contents.send.mock.calls.at(-1)![1].id;
    await s.invoke('reply', s.event, id, { ok: true });
    expect(await next).toEqual({ ok: true });
});
