import { randomUUID } from 'node:crypto';
import { mkdir, realpath, rename, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { BundleEntry, NativeBundleReference } from '../../src/platform/bundleContracts';
import { NativeSaves } from './nativeSaves';
import { grantId } from './nativeGrants';
import { NativeFileError, nativeError } from './nativeErrors';
import {
    absent,
    bundleEntries,
    bundleIdentity,
    cleanBundle,
    sameBundleObject,
    sameBundleFile,
    type BundleKind,
    type BundleIdentity,
} from './bundlePaths';

interface Bundle {
    id: string;
    parent: string;
    parentIdentity: BundleIdentity;
    target: string;
    temporary: string;
    identity: BundleIdentity;
    sourceIdentity?: BundleIdentity;
    entries: BundleEntry[];
    next: number;
    saveId: string | null;
    saves: NativeSaves;
    files: Map<string, BundleIdentity>;
    cancelled: boolean;
    committed: boolean;
    publishing: boolean;
    operation: Promise<void> | null;
    cleanup: Promise<void> | null;
}
export class NativeBundles {
    private bundles = new Map<string, Bundle>();
    private starting = new Set<Promise<NativeBundleReference>>();
    private generation = 0;
    private disposed = false;
    get revision() {
        return this.generation;
    }
    get busy() {
        return this.bundles.size > 0 || this.starting.size > 0;
    }
    begin(parentPath: string, name: string, kind: BundleKind, input: unknown): Promise<NativeBundleReference> {
        const work = this.create(parentPath, name, kind, input);
        this.starting.add(work);
        void work.then(
            () => this.starting.delete(work),
            () => this.starting.delete(work),
        );
        return work;
    }
    private async create(
        parentPath: string,
        name: string,
        kind: BundleKind,
        input: unknown,
    ): Promise<NativeBundleReference> {
        if (
            this.disposed ||
            (kind !== 'preset' && kind !== 'wallpaper') ||
            !/^(?:user-preset-[a-f0-9-]{1,64}|audiosurf-[a-f0-9-]{36})$/.test(name)
        )
            throw new NativeFileError('invalid-request');
        const entries = bundleEntries(kind, input),
            generation = this.generation,
            parent = await realpath(parentPath);
        const parentIdentity = await bundleIdentity(parent);
        if (!parentIdentity.isDirectory()) throw new NativeFileError('invalid-request');
        const target = path.join(parent, name);
        await absent(target);
        const id = randomUUID(),
            temporary = path.join(parent, `.audiosurf-bundle-${id}.tmp`);
        await mkdir(temporary, { mode: 0o700 });
        const bundle: Bundle = {
            id,
            parent,
            parentIdentity,
            target,
            temporary,
            identity: await bundleIdentity(temporary),
            entries,
            next: 0,
            saveId: null,
            saves: new NativeSaves(),
            files: new Map(),
            cancelled: false,
            committed: false,
            publishing: false,
            operation: null,
            cleanup: null,
        };
        this.bundles.set(id, bundle);
        const initialization = (async () => {
            if (kind === 'preset') {
                const source = path.join(temporary, 'source');
                await mkdir(source);
                bundle.sourceIdentity = await bundleIdentity(source);
            }
        })();
        bundle.operation = initialization;
        try {
            await initialization;
            bundle.operation = null;
            if (this.disposed || generation !== this.generation) throw new NativeFileError('invalid-request');
            return { bundleId: id, folderName: name };
        } catch (error) {
            bundle.operation = null;
            await this.abort(id);
            throw error;
        }
    }
    private get(id: string) {
        grantId(id);
        const bundle = this.bundles.get(id);
        if (!bundle || bundle.cancelled || bundle.committed) throw new NativeFileError('invalid-request');
        return bundle;
    }
    private async run(id: string, operation: (bundle: Bundle) => Promise<void>) {
        const bundle = this.get(id);
        if (bundle.operation || bundle.publishing) throw new NativeFileError('invalid-request');
        const work = operation(bundle);
        bundle.operation = work;
        try {
            await work;
            if (bundle.cancelled) throw new NativeFileError('invalid-request');
        } catch (error) {
            await this.abort(id);
            throw error;
        } finally {
            if (bundle.operation === work) bundle.operation = null;
        }
    }
    private async checkRoot(bundle: Bundle) {
        if (
            (await realpath(bundle.temporary)) !== bundle.temporary ||
            !sameBundleObject(await bundleIdentity(bundle.temporary), bundle.identity)
        )
            throw new NativeFileError('permission-denied');
        if (
            bundle.sourceIdentity &&
            !sameBundleObject(await bundleIdentity(path.join(bundle.temporary, 'source')), bundle.sourceIdentity)
        )
            throw new NativeFileError('permission-denied');
    }
    async beginFile(id: string) {
        return this.run(id, async bundle => {
            if (bundle.saveId || bundle.next >= bundle.entries.length) throw new NativeFileError('invalid-request');
            await this.checkRoot(bundle);
            const entry = bundle.entries[bundle.next]!;
            bundle.saveId = (await bundle.saves.begin(path.join(bundle.temporary, entry.name), entry.size)).saveId;
        });
    }
    async writeFile(id: string, chunk: unknown) {
        return this.run(id, async bundle => {
            if (!bundle.saveId) throw new NativeFileError('invalid-request');
            await bundle.saves.write(bundle.saveId, chunk);
        });
    }
    async closeFile(id: string) {
        return this.run(id, async bundle => {
            if (!bundle.saveId) throw new NativeFileError('invalid-request');
            await bundle.saves.commit(bundle.saveId);
            bundle.saveId = null;
            const name = bundle.entries[bundle.next]!.name;
            bundle.files.set(name, await bundleIdentity(path.join(bundle.temporary, name)));
            ++bundle.next;
        });
    }
    async commit(id: string) {
        return this.run(id, async bundle => {
            if (bundle.saveId || bundle.next !== bundle.entries.length) throw new NativeFileError('invalid-request');
            await this.checkRoot(bundle);
            if (
                (await realpath(bundle.parent)) !== bundle.parent ||
                !sameBundleObject(await bundleIdentity(bundle.parent), bundle.parentIdentity)
            )
                throw new NativeFileError('permission-denied');
            const actual = (await readdir(bundle.temporary))
                .flatMap(name => (name === 'source' ? ['source/resource.json'] : [name]))
                .sort();
            if (JSON.stringify(actual) !== JSON.stringify(bundle.entries.map(entry => entry.name).sort()))
                throw new NativeFileError('file-changed');
            if (
                bundle.sourceIdentity &&
                JSON.stringify(await readdir(path.join(bundle.temporary, 'source'))) !==
                    JSON.stringify(['resource.json'])
            )
                throw new NativeFileError('file-changed');
            for (const [name, identity] of bundle.files)
                if (!sameBundleFile(await bundleIdentity(path.join(bundle.temporary, name)), identity))
                    throw new NativeFileError('file-changed');
            await absent(bundle.target);
            if (bundle.cancelled) throw new NativeFileError('invalid-request');
            bundle.publishing = true;
            await rename(bundle.temporary, bundle.target);
            bundle.committed = true;
            this.bundles.delete(id);
        });
    }
    async abort(id: string): Promise<void> {
        grantId(id);
        const bundle = this.bundles.get(id);
        if (!bundle) return;
        if (!bundle.publishing) bundle.cancelled = true;
        await bundle.operation?.catch(() => {});
        if (bundle.committed) return;
        bundle.cleanup ??= (async () => {
            await bundle.saves.dispose();
            await cleanBundle(bundle.temporary, bundle.identity, bundle.files, bundle.sourceIdentity);
            this.bundles.delete(id);
        })();
        await bundle.cleanup;
    }
    async abortAll() {
        ++this.generation;
        const results = await Promise.allSettled([
            ...[...this.bundles.keys()].map(id => this.abort(id)),
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
