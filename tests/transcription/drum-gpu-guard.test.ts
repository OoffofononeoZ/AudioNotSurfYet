import { afterEach, expect, it, vi } from 'vitest';
import { DrumGpuGuard } from '../../src/transcription/drumGpuGuard';
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});
function device() {
    let lose!: (info: GPUDeviceLostInfo) => void;
    const gpu = {
        lost: new Promise<GPUDeviceLostInfo>(resolve => {
            lose = resolve;
        }),
    } as GPUDevice;
    return { gpu, lose: () => lose({ reason: 'destroyed', message: 'test-owned device' } as GPUDeviceLostInfo) };
}
it('preserves normal operation values and awaits release without leaving the observer timer', async () => {
    vi.useFakeTimers();
    const read = vi.fn(() => undefined),
        remove = vi.fn();
    vi.stubGlobal('removeEventListener', remove);
    const guard = new DrumGpuGuard(read),
        released = vi.fn(async () => {});
    expect(await guard.run(async () => new Float32Array([1, 2]))).toEqual(new Float32Array([1, 2]));
    await guard.release([released, released]);
    expect(released).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledOnce();
});
it('observes the device when ORT initializes it later and rejects a hung run after actual loss', async () => {
    vi.useFakeTimers();
    const f = device();
    let current: GPUDevice | undefined;
    const guard = new DrumGpuGuard(() => current),
        pending = guard.run(() => new Promise<never>(() => {})),
        rejected = expect(pending).rejects.toMatchObject({ code: 'webgpu-device-lost' });
    current = f.gpu;
    await vi.advanceTimersByTimeAsync(25);
    f.lose();
    await rejected;
    expect(guard.hasLost).toBe(true);
    const release = vi.fn(() => new Promise<void>(() => {}));
    await guard.release([release]);
    expect(release).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
});
it('suppresses only the late GPU map abort after loss, while other rejected promises stay visible', async () => {
    let listener!: EventListener;
    vi.stubGlobal('addEventListener', (_: string, callback: EventListener) => {
        listener = callback;
    });
    const f = device(),
        guard = new DrumGpuGuard(() => f.gpu);
    await Promise.resolve();
    const preventDefault = vi.fn(),
        known = {
            reason: new DOMException('GPUBuffer: The Device was lost before mapping was resolved.', 'AbortError'),
            preventDefault,
        },
        unmapped = {
            reason: new DOMException(
                "Failed to execute 'mapAsync' on 'GPUBuffer': Buffer was unmapped before mapping was resolved.",
                'AbortError',
            ),
            preventDefault,
        };
    f.lose();
    await Promise.resolve();
    await Promise.resolve();
    listener(known as unknown as Event);
    expect(preventDefault).toHaveBeenCalledOnce();
    listener(unmapped as unknown as Event);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    listener({ reason: Error('unrelated'), preventDefault } as unknown as Event);
    listener({ reason: new DOMException('Unrelated abort', 'AbortError'), preventDefault } as unknown as Event);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    guard.close();
});

it('retains an early GPU map abort until the following device loss is confirmed', async () => {
    vi.useFakeTimers();
    let listener!: EventListener;
    vi.stubGlobal('addEventListener', (_: string, callback: EventListener) => {
        listener = callback;
    });
    const report = vi.fn();
    vi.stubGlobal('reportError', report);
    const f = device(),
        guard = new DrumGpuGuard(() => f.gpu);
    await Promise.resolve();
    const preventDefault = vi.fn(),
        reason = new DOMException('GPUBuffer: Buffer was unmapped before mapping was resolved.', 'AbortError');
    listener({ reason, preventDefault } as unknown as Event);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
    f.lose();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(50);
    expect(report).not.toHaveBeenCalled();
    guard.close();
    expect(vi.getTimerCount()).toBe(0);
});

it('reports the exact deferred abort if the owned device remains alive and flushes it on normal close', async () => {
    vi.useFakeTimers();
    let listener!: EventListener;
    vi.stubGlobal('addEventListener', (_: string, callback: EventListener) => {
        listener = callback;
    });
    const report = vi.fn();
    vi.stubGlobal('reportError', report);
    const f = device(),
        guard = new DrumGpuGuard(() => f.gpu);
    await Promise.resolve();
    const reason = new DOMException('GPUBuffer: Buffer was unmapped before mapping was resolved.', 'AbortError');
    listener({ reason, preventDefault: vi.fn() } as unknown as Event);
    await vi.advanceTimersByTimeAsync(50);
    expect(report).toHaveBeenCalledExactlyOnceWith(reason);
    listener({ reason, preventDefault: vi.fn() } as unknown as Event);
    guard.close();
    expect(report).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
});
