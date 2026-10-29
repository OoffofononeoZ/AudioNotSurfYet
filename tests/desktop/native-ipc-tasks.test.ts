import { expect, test, vi } from 'vitest';
import { NativeIpcTasks } from '../../electron/files/nativeIpcTasks';
import { NativeFileError } from '../../electron/files/nativeErrors';

test('suspension rejects new file operations and drains an existing dialog without renewing its lease', async () => {
    const tasks = new NativeIpcTasks(),
        revision = tasks.revision;
    let release!: () => void;
    const work = tasks.run(
        () =>
            new Promise<void>(resolve => {
                release = resolve;
            }),
    );
    expect(tasks.busy).toBe(true);
    tasks.suspend();
    const operation = vi.fn(async () => {});
    await expect(tasks.run(operation)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(operation).not.toHaveBeenCalled();
    let stopped = false;
    const draining = tasks.drain().then(() => {
        stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    tasks.resume();
    expect(tasks.current(revision)).toBe(false);
    await tasks.run(operation);
    release();
    await Promise.all([work, draining]);
    expect(tasks.busy).toBe(false);
});

test('draining propagates cleanup failure but permits a normal cancelled operation', async () => {
    for (const code of ['cleanup-failed', 'invalid-request'] as const) {
        const tasks = new NativeIpcTasks();
        let reject!: (error: Error) => void;
        const work = tasks.run(
            () =>
                new Promise<void>((_resolve, fail) => {
                    reject = fail;
                }),
        );
        const handled = work.catch(() => {});
        tasks.suspend();
        const drain = tasks.drain();
        reject(new NativeFileError(code));
        if (code === 'cleanup-failed') await expect(drain).rejects.toMatchObject({ code });
        else await drain;
        await handled;
    }
});
