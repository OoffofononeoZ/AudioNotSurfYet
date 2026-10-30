import { expect, test, vi } from 'vitest';
import { HostShutdown, type HostShutdownPorts } from '../../electron/hostShutdown';
import type { ClosePhase, CloseReply } from '../../src/platform/lifecycleContracts';
function fixture() {
    const calls: string[] = [];
    const ports: HostShutdownPorts = {
        exchange: vi.fn(async (phase: ClosePhase): Promise<CloseReply> => {
            calls.push(phase);
            return phase === 'inspect'
                ? { ok: true, summary: { unsaved: false, tasks: false, output: false } }
                : { ok: true };
        }),
        nativeBusy: () => false,
        confirm: vi.fn(async () => true),
        suspendFiles: () => {
            calls.push('suspend');
        },
        cleanupFiles: vi.fn(async () => {
            calls.push('files');
        }),
        resumeFiles: () => {
            calls.push('resume-files');
        },
        flushStorage: async () => {
            calls.push('storage');
        },
        finish: vi.fn(() => {
            calls.push('finish');
        }),
        report: vi.fn(async () => {}),
    };
    return { ports, calls, shutdown: new HostShutdown(ports) };
}
test('ordinary close waits for drafts, native cleanup, storage and renderer disposal in order', async () => {
    const s = fixture();
    await s.shutdown.requestClose();
    expect(s.calls).toEqual(['inspect', 'prepare', 'suspend', 'files', 'storage', 'dispose', 'finish']);
    expect(s.ports.confirm).not.toHaveBeenCalled();
    expect(s.shutdown.completed).toBe(true);
});
test('declining the warning leaves tasks and the window intact', async () => {
    const s = fixture();
    s.ports.nativeBusy = () => true;
    vi.mocked(s.ports.confirm).mockResolvedValue(false);
    await s.shutdown.requestClose();
    expect(s.calls).toEqual(['inspect']);
    expect(s.shutdown.completed).toBe(false);
});
test.each(['prepare', 'files'] as const)(
    'a %s failure preserves the window and permits retry after resuming',
    async failure => {
        const s = fixture();
        if (failure === 'prepare')
            vi.mocked(s.ports.exchange)
                .mockImplementationOnce(async () => ({
                    ok: true,
                    summary: { unsaved: true, tasks: false, output: false },
                }))
                .mockImplementationOnce(async () => ({ ok: false, message: '保存失败' }));
        else vi.mocked(s.ports.cleanupFiles).mockRejectedValueOnce(Error('cleanup'));
        await s.shutdown.requestClose();
        expect(s.ports.finish).not.toHaveBeenCalled();
        expect(s.ports.report).toHaveBeenCalled();
        expect(s.calls).toContain('resume-files');
        expect(s.calls).toContain('resume');
        expect(s.calls).not.toContain('dispose');
        await s.shutdown.requestClose();
        expect(s.ports.finish).toHaveBeenCalledTimes(1);
    },
);
test('a frame change during disposal leaves the replacement window usable and permits another close attempt', async () => {
    const s = fixture();
    const exchange = s.ports.exchange;
    vi.mocked(s.ports.exchange)
        .mockImplementationOnce(async () => ({ ok: true, summary: { unsaved: false, tasks: false, output: false } }))
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(Error('frame changed'));
    await s.shutdown.requestClose();
    expect(s.ports.finish).not.toHaveBeenCalled();
    expect(s.calls).toContain('resume-files');
    expect(s.calls).toContain('resume');
    s.ports.exchange = exchange;
    await s.shutdown.requestClose();
    expect(s.ports.finish).toHaveBeenCalledTimes(1);
});

test('closing an unresponsive page always requires native confirmation and still waits for files', async () => {
    const s = fixture();
    vi.mocked(s.ports.exchange).mockRejectedValue(Error('not ready'));
    vi.mocked(s.ports.confirm).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await s.shutdown.requestClose();
    expect(s.ports.finish).not.toHaveBeenCalled();
    expect(s.ports.confirm).toHaveBeenCalledWith(null);
    await s.shutdown.requestClose();
    expect(s.calls).toEqual(['suspend', 'files', 'storage', 'finish']);
});
test('repeated close requests share the same in-flight cleanup and cannot destroy the window early', async () => {
    const s = fixture();
    let release!: () => void;
    vi.mocked(s.ports.cleanupFiles).mockImplementation(
        () =>
            new Promise(resolve => {
                release = resolve;
            }),
    );
    const pending = s.shutdown.requestClose();
    await vi.waitFor(() => expect(s.ports.cleanupFiles).toHaveBeenCalledTimes(1));
    expect(s.shutdown.requestClose()).toBe(pending);
    expect(s.ports.finish).not.toHaveBeenCalled();
    release();
    await pending;
    expect(s.ports.finish).toHaveBeenCalledTimes(1);
});
