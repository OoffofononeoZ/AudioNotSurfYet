import { createHash, randomUUID, type Hash } from 'node:crypto';
import { lstat, open, realpath, rename, unlink, type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { SAVE_CHUNK_BYTES, type NativeSaveReference } from '../../src/platform/transferContracts';
import { grantId } from './nativeGrants';
import { NativeFileError, nativeError } from './nativeErrors';
import type { NativeSaveJournal } from './nativeSaveJournal';

interface Identity {
    dev: number;
    ino: number;
    size: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;
}
interface Save {
    id: string;
    target: string;
    temporary: string;
    parent: string;
    parentIdentity: Identity;
    targetIdentity: Identity | null;
    temporaryIdentity: Identity;
    handle: FileHandle;
    size: number;
    written: number;
    hash: Hash;
    cancelled: boolean;
    committed: boolean;
    phase: 'writing' | 'committing' | 'publishing';
    operation: Promise<void> | null;
    cleanup: Promise<void> | null;
}

async function identity(file: string): Promise<Identity | null> {
    try {
        const info = await lstat(file);
        if (info.isSymbolicLink()) throw new NativeFileError('permission-denied');
        return info;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
    }
}
const sameObject = (a: Identity, b: Identity) => a.dev === b.dev && a.ino === b.ino && a.birthtimeMs === b.birthtimeMs;
const unchanged = (a: Identity | null, b: Identity | null) =>
    a && b ? sameObject(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs : a === b;

/** Paths enter only from the main-process save dialog. Renderer owns opaque, one-use IDs. */
export class NativeSaves {
    private saves = new Map<string, Save>();
    private starting = new Set<Promise<NativeSaveReference>>();
    private disposed = false;
    private generation = 0;
    private readonly journal?: NativeSaveJournal;
    constructor(journal?: NativeSaveJournal) {
        this.journal = journal;
    }
    get revision() {
        return this.generation;
    }
    get busy() {
        return this.saves.size > 0 || this.starting.size > 0;
    }

    begin(selectedPath: string, size: number): Promise<NativeSaveReference> {
        const work = this.create(selectedPath, size);
        this.starting.add(work);
        void work.then(
            () => this.starting.delete(work),
            () => this.starting.delete(work),
        );
        return work;
    }

    private async create(selectedPath: string, size: number): Promise<NativeSaveReference> {
        if (this.disposed || !Number.isSafeInteger(size) || size < 0) throw new NativeFileError('invalid-request');
        const generation = this.generation;
        const parent = await realpath(path.dirname(selectedPath));
        const target = path.join(parent, path.basename(selectedPath));
        const parentIdentity = (await identity(parent))!;
        const targetIdentity = await identity(target);
        if (targetIdentity && !(await lstat(target)).isFile()) throw new NativeFileError('invalid-request');
        const id = randomUUID(),
            temporary = path.join(parent, `.audiosurf-${id}.tmp`);
        const handle = await open(temporary, 'wx', 0o600);
        let temporaryIdentity: Identity;
        try {
            temporaryIdentity = await handle.stat();
        } catch (error) {
            await handle.close().catch(() => {});
            try {
                await unlink(temporary);
            } catch {
                throw new NativeFileError('cleanup-failed');
            }
            throw nativeError(error);
        }
        const save: Save = {
            id,
            target,
            temporary,
            parent,
            parentIdentity,
            targetIdentity,
            temporaryIdentity,
            handle,
            size,
            written: 0,
            hash: createHash('sha256'),
            cancelled: false,
            committed: false,
            phase: 'writing',
            operation: null,
            cleanup: null,
        };
        this.saves.set(id, save);
        try {
            await this.checkpoint(save);
            if (this.disposed || generation !== this.generation) throw new NativeFileError('invalid-request');
        } catch (error) {
            await this.abort(id);
            await this.forget(save);
            throw error;
        }
        return { saveId: id, name: path.basename(target) };
    }

    private get(id: string) {
        grantId(id);
        const save = this.saves.get(id);
        if (!save || save.cancelled || save.committed) throw new NativeFileError('invalid-request');
        return save;
    }
    private check(save: Save) {
        if (save.cancelled) throw new NativeFileError('invalid-request');
    }
    private async checkpoint(save: Save) {
        await this.journal?.checkpoint(
            save.temporary,
            save.parentIdentity,
            save.temporaryIdentity,
            save.written,
            save.hash.copy().digest('hex'),
        );
    }
    private async forget(save: Save) {
        try {
            await this.journal?.forget(save.temporary);
        } catch {
            console.warn('Native save journal record retained; its missing temporary will be rechecked on restart');
        }
    }

    async write(id: string, input: unknown): Promise<void> {
        const save = this.get(id);
        if (
            save.operation ||
            save.phase !== 'writing' ||
            !(input instanceof Uint8Array) ||
            input.byteLength < 1 ||
            input.byteLength > SAVE_CHUNK_BYTES ||
            save.written + input.byteLength > save.size
        )
            throw new NativeFileError('invalid-request');
        const chunk = new Uint8Array(input);
        const operation = (async () => {
            let offset = 0;
            while (offset < chunk.byteLength) {
                this.check(save);
                const { bytesWritten } = await save.handle.write(chunk, offset, chunk.byteLength - offset);
                if (!bytesWritten) throw new NativeFileError('io-error');
                offset += bytesWritten;
            }
            this.check(save);
            save.written += offset;
            save.hash.update(chunk);
            await this.checkpoint(save);
            this.check(save);
        })();
        save.operation = operation;
        try {
            await operation;
        } catch (error) {
            await this.abort(id);
            throw nativeError(error);
        } finally {
            if (save.operation === operation) save.operation = null;
        }
    }

    async commit(id: string): Promise<void> {
        const save = this.get(id);
        if (save.operation || save.phase !== 'writing' || save.written !== save.size)
            throw new NativeFileError('invalid-request');
        save.phase = 'committing';
        const operation = (async () => {
            await save.handle.sync();
            this.check(save);
            const parent = await realpath(save.parent),
                parentIdentity = await identity(parent);
            const temporaryIdentity = await identity(save.temporary);
            if (
                parent !== save.parent ||
                !parentIdentity ||
                !sameObject(parentIdentity, save.parentIdentity) ||
                !temporaryIdentity ||
                !sameObject(temporaryIdentity, save.temporaryIdentity)
            )
                throw new NativeFileError('permission-denied');
            if (!unchanged(save.targetIdentity, await identity(save.target))) throw new NativeFileError('file-changed');
            if ((await save.handle.stat()).size !== save.size) throw new NativeFileError('io-error');
            await save.handle.close();
            this.check(save);
            // Atomic publication is the commit point. Cancellation cannot retract a completed rename.
            save.phase = 'publishing';
            await rename(save.temporary, save.target);
            save.committed = true;
            this.saves.delete(id);
            await this.forget(save);
        })();
        save.operation = operation;
        try {
            await operation;
        } catch (error) {
            await this.abort(id);
            throw nativeError(error);
        } finally {
            if (save.operation === operation) save.operation = null;
        }
    }

    async abort(id: string): Promise<void> {
        grantId(id);
        const save = this.saves.get(id);
        if (!save) return;
        if (save.phase !== 'publishing') save.cancelled = true;
        await save.operation?.catch(() => {});
        if (save.committed) return;
        save.cleanup ??= (async () => {
            await save.handle.close().catch(() => {});
            try {
                const actual = await identity(save.temporary);
                if (actual) {
                    if (!sameObject(actual, save.temporaryIdentity)) throw new NativeFileError('cleanup-failed');
                    await unlink(save.temporary);
                }
                this.saves.delete(id);
                await this.forget(save);
            } catch {
                throw new NativeFileError('cleanup-failed');
            }
        })();
        await save.cleanup;
    }

    async abortAll(): Promise<void> {
        ++this.generation;
        const results = await Promise.allSettled([
            ...[...this.saves.keys()].map(id => this.abort(id)),
            ...[...this.starting].map(work =>
                work.catch(error => {
                    if (nativeError(error).code === 'cleanup-failed') throw error;
                }),
            ),
        ]);
        if (results.some(result => result.status === 'rejected')) throw new NativeFileError('cleanup-failed');
    }
    async dispose() {
        this.disposed = true;
        await this.abortAll();
    }
}
