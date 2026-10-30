import { expect, test, vi } from 'vitest';
import { SessionRepositoryTasks } from '../../src/persistence/sessionRepositoryTasks';
import type { PersistedQueueInput, SessionRepositoryPort } from '../../src/persistence/sessionRepository';

test('shutdown drain waits for both the active transaction and a follow-up write queued by its caller', async () => {
    const releases: (() => void)[] = [];
    const saveQueue = vi.fn(() => new Promise<void>(resolve => releases.push(resolve)));
    const repository = new SessionRepositoryTasks({ saveQueue } as unknown as SessionRepositoryPort);
    const first = repository.saveQueue({} as PersistedQueueInput);
    let drained = false;
    const drain = repository.flush().then(() => {
        drained = true;
    });
    const next = first.then(() => repository.saveQueue({} as PersistedQueueInput));
    releases[0]!();
    await vi.waitFor(() => expect(saveQueue).toHaveBeenCalledTimes(2));
    expect(drained).toBe(false);
    releases[1]!();
    await Promise.all([next, drain]);
    expect(repository.busy).toBe(false);
});

test('a transaction failure still reaches its caller while draining settles for the runtime to inspect persistence state', async () => {
    let reject!: (error: Error) => void;
    const saveQueue = () =>
        new Promise<void>((_resolve, fail) => {
            reject = fail;
        });
    const repository = new SessionRepositoryTasks({ saveQueue } as unknown as SessionRepositoryPort);
    const failure = expect(repository.saveQueue({} as PersistedQueueInput)).rejects.toThrow('quota');
    const drain = repository.flush();
    reject(Error('quota'));
    await Promise.all([failure, drain]);
    expect(repository.busy).toBe(false);
});
