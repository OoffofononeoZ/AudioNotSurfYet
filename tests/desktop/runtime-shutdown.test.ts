import { expect, test, vi } from 'vitest';
import { createRuntimeShutdown, type RuntimeShutdownPorts } from '../../src/platform/runtimeShutdown';
import { DesktopLifecycle } from '../../src/platform/desktopLifecycle';
import type { CloseRequest, CloseReply, DesktopLifecycleBridge } from '../../src/platform/lifecycleContracts';

function fixture() {
    const calls: string[] = [];
    const ports = {
        audio: { cancelPendingOperations: () => calls.push('audio-stop'), flushForShutdown: vi.fn(async () => true) },
        editor: {
            cancelPendingOperations: () => {},
            flushForShutdown: vi.fn(async () => true),
            hasPendingWrite: () => true,
            hasUnexportedWork: () => false,
            getSnapshot: () => ({ persistence: 'saving' }),
        },
        visualizer: {
            cancelPendingOperations: vi.fn(async () => {}),
            flush: vi.fn(async () => true),
            hasPendingWrite: () => false,
            hasUnresolvedExportOutput: () => true,
        },
        transcription: {
            getSnapshot: () => ({ status: 'running', persistence: 'saving' }),
            flushEdits: vi.fn(async () => {
                calls.push('edits');
                return true;
            }),
            cancel: () => calls.push('transcription-stop'),
        },
        separation: { getSnapshot: () => ({ status: 'running' }), cancel: () => calls.push('separation-stop') },
        analysis: { hasActiveTasks: () => true, cancel: () => {} },
        repository: { busy: true, flush: vi.fn(async () => {}) },
        session: () => ({ persistence: { state: 'saving' }, playback: { state: 'paused' } }),
        audioReady: Promise.resolve(),
        lock: vi.fn(),
        dispose: vi.fn(async () => {}),
        unmount: vi.fn(),
    };
    return { calls, ports, participant: createRuntimeShutdown(ports as unknown as RuntimeShutdownPorts) };
}
test('shutdown reports unsaved output and tasks, flushes candidate edits before cancellation and does not dispose during prepare', async () => {
    const s = fixture();
    expect(s.participant.inspect()).toEqual({ unsaved: true, tasks: true, output: true });
    await s.participant.prepare();
    expect(s.calls.indexOf('edits')).toBeLessThan(s.calls.indexOf('transcription-stop'));
    expect(s.calls.indexOf('edits')).toBeLessThan(s.calls.indexOf('separation-stop'));
    expect(s.ports.dispose).not.toHaveBeenCalled();
    expect(s.ports.lock).toHaveBeenCalledWith(true);
    await s.participant.dispose();
    expect(s.ports.dispose).toHaveBeenCalledTimes(1);
    expect(s.ports.unmount).toHaveBeenCalledTimes(1);
});
test('a failed draft remains alive and can be flushed on the next close attempt', async () => {
    const s = fixture();
    s.ports.editor.flushForShutdown.mockResolvedValueOnce(false);
    await expect(s.participant.prepare()).rejects.toThrow('尚未保存');
    await expect(s.participant.dispose()).rejects.toThrow('尚未完成');
    expect(s.ports.dispose).not.toHaveBeenCalled();
    s.participant.resume();
    expect(s.ports.lock).toHaveBeenLastCalledWith(false);
    await s.participant.prepare();
    await s.participant.dispose();
    expect(s.ports.unmount).toHaveBeenCalledTimes(1);
});
test('failed candidate edits are not aborted or discarded before their owner can retry', async () => {
    const s = fixture();
    s.ports.transcription.flushEdits.mockResolvedValue(false);
    await expect(s.participant.prepare()).rejects.toThrow('候选修正');
    expect(s.calls).not.toContain('transcription-stop');
    expect(s.calls).not.toContain('separation-stop');
    expect(s.ports.dispose).not.toHaveBeenCalled();
});
test('the desktop bridge serializes requests and acknowledges disposal even when unmount removes its listener', async () => {
    const s = fixture();
    let receive!: (request: CloseRequest) => void, detach!: () => void;
    const reply = vi.fn<DesktopLifecycleBridge['reply']>(async () => ({ ok: true, value: undefined }));
    const bridge: DesktopLifecycleBridge = {
        onRequest: callback => {
            receive = callback;
            return vi.fn();
        },
        ready: async () => ({ ok: true, value: undefined }),
        reply,
    };
    const lifecycle = new DesktopLifecycle(bridge);
    s.ports.unmount.mockImplementation(() => detach());
    detach = lifecycle.register(s.participant);
    for (const phase of ['inspect', 'prepare', 'dispose'] as const) receive({ id: phase, phase });
    await vi.waitFor(() => expect(reply).toHaveBeenCalledTimes(3));
    expect(reply.mock.calls.map(call => call[1] as CloseReply)).toEqual([
        { ok: true, summary: { unsaved: true, tasks: true, output: true } },
        { ok: true },
        { ok: true },
    ]);
});
