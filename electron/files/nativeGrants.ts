import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, realpath, readdir, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import type {
    NativeDirectoryEntry,
    NativeDirectoryReference,
    NativeFileDescriptor,
    NativeFileReference,
} from '../../src/platform/fileContracts';
import { NativeFileError, nativeError } from './nativeErrors';

interface Grant {
    id: string;
    kind: 'file' | 'directory';
    path: string;
    name: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
};

export function grantId(value: unknown): string {
    if (typeof value !== 'string' || !uuid.test(value)) throw new NativeFileError('invalid-request');
    return value;
}

export function grantRelativePath(value: unknown): string {
    if (
        typeof value !== 'string' ||
        /[\\:%?#\x00-\x1f]/.test(value) ||
        (value !== '' && value.split('/').some(part => !part || part === '.' || part === '..'))
    ) {
        throw new NativeFileError('invalid-request');
    }
    return value;
}

function within(root: string, target: string) {
    const relative = path.relative(root, target);
    return (
        relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
    );
}

/** Only main-process user selections may create persistent, read-only grants. */
export class NativeReadGrants {
    private grants = new Map<string, Grant>();
    private loaded: Promise<void> | null = null;
    private writes: Promise<unknown> = Promise.resolve();
    private readonly storageFile: string;

    constructor(storageFile: string) {
        this.storageFile = path.resolve(storageFile);
    }

    private load() {
        this.loaded ??= (async () => {
            let text: string;
            try {
                text = await readFile(this.storageFile, 'utf8');
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
                throw nativeError(error);
            }
            try {
                const input = JSON.parse(text);
                if (input.version !== 1 || !Array.isArray(input.grants)) throw Error('Invalid grant store');
                const next = new Map<string, Grant>();
                for (const entry of input.grants) {
                    if (
                        !entry ||
                        !uuid.test(entry.id) ||
                        next.has(entry.id) ||
                        !['file', 'directory'].includes(entry.kind) ||
                        typeof entry.path !== 'string' ||
                        !path.isAbsolute(entry.path) ||
                        path.normalize(entry.path) !== entry.path ||
                        typeof entry.name !== 'string' ||
                        !entry.name
                    )
                        throw Error('Invalid grant');
                    next.set(entry.id, { id: entry.id, kind: entry.kind, path: entry.path, name: entry.name });
                }
                this.grants = next;
            } catch {
                throw new NativeFileError('store-invalid');
            }
        })();
        return this.loaded;
    }

    private async publish(next: Map<string, Grant>) {
        await mkdir(path.dirname(this.storageFile), { recursive: true });
        const temporary = `${this.storageFile}.${randomUUID()}.tmp`;
        const handle = await open(temporary, 'wx');
        try {
            await handle.writeFile(JSON.stringify({ version: 1, grants: [...next.values()] }, null, 2) + '\n', 'utf8');
            await handle.sync();
            await handle.close();
            await rename(temporary, this.storageFile);
            this.grants = next;
        } catch (error) {
            await handle.close().catch(() => {});
            await unlink(temporary).catch(() => {});
            throw nativeError(error);
        }
    }

    private async add(selectedPath: string, kind: Grant['kind']): Promise<Grant> {
        await this.load();
        const operation = this.writes
            .catch(() => {})
            .then(async () => {
                const target = await realpath(selectedPath),
                    info = await stat(target);
                if (kind === 'file' ? !info.isFile() : !info.isDirectory())
                    throw new NativeFileError('invalid-request');
                const existing = [...this.grants.values()].find(entry => entry.kind === kind && entry.path === target);
                if (existing) return existing;
                const entry: Grant = {
                    id: randomUUID(),
                    kind,
                    path: target,
                    name: path.basename(selectedPath) || target,
                };
                const next = new Map(this.grants);
                next.set(entry.id, entry);
                await this.publish(next);
                return entry;
            });
        this.writes = operation;
        return operation.catch(error => {
            throw nativeError(error);
        });
    }

    async selectFile(selectedPath: string): Promise<NativeFileReference> {
        return this.reference(await this.add(selectedPath, 'file'));
    }

    async selectDirectory(selectedPath: string): Promise<NativeDirectoryReference> {
        const entry = await this.add(selectedPath, 'directory');
        return { kind: 'directory', platform: 'electron', grantId: entry.id, name: entry.name };
    }

    private reference(entry: Grant): NativeFileReference {
        return { kind: 'file', platform: 'electron', grantId: entry.id, name: entry.name };
    }

    private async get(id: string, kind?: Grant['kind']) {
        grantId(id);
        await this.load();
        const entry = this.grants.get(id);
        if (!entry || (kind && kind !== entry.kind)) throw new NativeFileError('permission-denied');
        return entry;
    }

    async permission(id: string): Promise<PermissionState> {
        grantId(id);
        await this.load();
        // A missing on-disk file is still an authorized reference. Reading reports
        // file-missing rather than misclassifying it as a permission rejection.
        return this.grants.has(id) ? 'granted' : 'denied';
    }

    async revoke(id: string): Promise<void> {
        grantId(id);
        await this.load();
        const operation = this.writes
            .catch(() => {})
            .then(async () => {
                if (!this.grants.has(id)) return;
                const next = new Map(this.grants);
                next.delete(id);
                await this.publish(next);
            });
        this.writes = operation;
        await operation;
    }

    async resolveFile(id: string): Promise<string> {
        const entry = await this.get(id, 'file');
        try {
            const actual = await realpath(entry.path);
            if (actual !== entry.path || !(await stat(actual)).isFile()) throw new NativeFileError('permission-denied');
            return actual;
        } catch (error) {
            throw nativeError(error);
        }
    }

    private async directoryPath(id: string, relativePath: string) {
        const entry = await this.get(id, 'directory');
        grantRelativePath(relativePath);
        try {
            const root = await realpath(entry.path);
            if (root !== entry.path) throw new NativeFileError('permission-denied');
            const target = await realpath(path.join(root, relativePath));
            if (!within(root, target)) throw new NativeFileError('permission-denied');
            return target;
        } catch (error) {
            throw nativeError(error);
        }
    }

    async list(id: string, relativePath: string): Promise<NativeDirectoryEntry[]> {
        const target = await this.directoryPath(id, relativePath);
        try {
            const entries = await readdir(target, { withFileTypes: true });
            const result: NativeDirectoryEntry[] = [];
            for (const entry of entries) {
                const child = [relativePath, entry.name].filter(Boolean).join('/');
                const info = await stat(await this.directoryPath(id, child));
                if (info.isDirectory() || info.isFile())
                    result.push({ name: entry.name, kind: info.isDirectory() ? 'directory' : 'file' });
                else throw new NativeFileError('invalid-request');
            }
            return result;
        } catch (error) {
            throw nativeError(error);
        }
    }

    async resolveDirectoryFile(id: string, relativePath: string): Promise<string> {
        const target = await this.directoryPath(id, relativePath);
        if (!(await stat(target)).isFile()) throw new NativeFileError('invalid-request');
        return target;
    }

    async directoryFile(id: string, relativePath: string): Promise<NativeFileDescriptor> {
        const target = await this.resolveDirectoryFile(id, relativePath);
        return this.descriptor(target, {
            kind: 'file',
            platform: 'electron',
            grantId: id,
            relativePath,
            name: path.basename(target),
        });
    }

    async describe(id: string): Promise<NativeFileDescriptor> {
        const entry = await this.get(id, 'file'),
            target = await this.resolveFile(id);
        return this.descriptor(target, this.reference(entry));
    }

    private async descriptor(target: string, reference: NativeFileReference): Promise<NativeFileDescriptor> {
        try {
            const info = await stat(target);
            return {
                reference,
                size: info.size,
                lastModified: Math.trunc(info.mtimeMs),
                mimeType: mimeTypes[path.extname(reference.name).toLowerCase()] ?? 'application/octet-stream',
                revision: `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}`,
                readUrl:
                    `app://audiosurf/native-files/${reference.grantId}` +
                    (reference.relativePath === undefined ? '' : `?path=${encodeURIComponent(reference.relativePath)}`),
            };
        } catch (error) {
            throw nativeError(error);
        }
    }
}
