import { elementRegistry, type ElementRegistry } from './elementRegistry';
import { validateRuntimeSnapshot } from './validateRuntimeSnapshot';
import {
    readResourceDirectory,
    type DirectoryCandidate,
    type ResourceDirectoryHandle,
    type ResourceInfo,
} from './resourceDirectory';
import { IndexedDbResourceDirectoryRepository, type ResourceDirectoryRepository } from './resourceDirectoryRepository';
import type { ResourceSnapshot } from './resourceTypes';
import { DEFAULT_RESOURCE_PREVIEW } from './resourcePreview';

export interface ResourceLibraryState extends ResourceSnapshot {
    status: 'idle' | 'loading' | 'ready' | 'error' | 'permission';
    entries: Array<{ info: ResourceInfo; previewUrl: string }>;
    folderName?: string;
    message?: string;
    canRestore: boolean;
}
export interface ResourceLibraryOptions {
    registry?: ElementRegistry;
    repository?: ResourceDirectoryRepository;
    picker?: () => Promise<ResourceDirectoryHandle>;
    read?: (handle: ResourceDirectoryHandle, signal: AbortSignal) => Promise<DirectoryCandidate>;
    validate?: typeof validateRuntimeSnapshot;
    createUrl?: (blob: Blob) => string;
    revokeUrl?: (url: string) => void;
}
const empty = (): ResourceLibraryState => ({
    algorithms: [],
    elements: [],
    presets: [],
    entries: [],
    status: 'idle',
    canRestore: false,
});
type Task = { generation: number; signal: AbortSignal };
/** One page owns the handle, candidate task and preview URLs; projects use embedded snapshots. */
export class VisualizerResourceLibrary {
    private state = empty();
    private settled = this.state;
    private task: AbortController | null = null;
    private generation = 0;
    private disposed = false;
    private active: ResourceDirectoryHandle | null = null;
    private pending: ResourceDirectoryHandle | null = null;
    private writes = Promise.resolve();
    private listeners = new Set<(state: ResourceLibraryState) => void>();
    private registry: ElementRegistry;
    private repository: ResourceDirectoryRepository;
    private options: ResourceLibraryOptions;
    constructor(options: ResourceLibraryOptions = {}) {
        this.options = options;
        this.registry = options.registry ?? elementRegistry;
        this.repository = options.repository ?? new IndexedDbResourceDirectoryRepository();
    }
    subscribe(listener: (state: ResourceLibraryState) => void) {
        this.listeners.add(listener);
        listener(this.snapshot());
        return () => this.listeners.delete(listener);
    }
    snapshot() {
        return structuredClone(this.state);
    }
    /** The export action requests write permission only after an explicit save click. */
    exportDirectory(): ResourceDirectoryHandle {
        if (this.disposed || !this.active || this.state.status !== 'ready')
            throw Error('请先在资源商城加载可用的资源库。');
        return this.active;
    }
    private publish(state: ResourceLibraryState) {
        this.state = state;
        if (state.status !== 'loading') this.settled = state;
        for (const listener of this.listeners) listener(this.snapshot());
    }
    private begin(): Task {
        this.task?.abort();
        this.task = new AbortController();
        const task = { generation: ++this.generation, signal: this.task.signal };
        this.publish({ ...this.settled, status: 'loading', message: undefined });
        return task;
    }
    private current(task: Task) {
        return !this.disposed && task.generation === this.generation && !task.signal.aborted;
    }
    private failure(task: Task, error: unknown) {
        if (!this.current(task)) return;
        if ((error as Error).name === 'AbortError') {
            this.publish(this.settled);
            return;
        }
        if (this.pending && ['NotAllowedError', 'SecurityError'].includes((error as Error).name)) {
            this.publish({
                ...this.settled,
                status: 'permission',
                canRestore: true,
                message: '资源文件夹读取权限已失效，请恢复访问。',
            });
            return;
        }
        this.publish({ ...this.settled, status: 'error', message: (error as Error).message });
    }
    async restore() {
        if (this.disposed) return;
        const task = this.begin();
        try {
            const handle = await this.repository.read();
            if (!this.current(task)) return;
            if (!handle) {
                this.publish({ ...this.settled, status: 'idle' });
                return;
            }
            this.pending = handle;
            await this.loadHandle(handle, task, false);
        } catch (error) {
            this.failure(task, error);
        }
    }
    async choose() {
        if (this.disposed) return;
        const task = this.begin();
        try {
            const picker =
                this.options.picker ??
                (() => {
                    const host = window as unknown as {
                        showDirectoryPicker?: (options: {
                            id: string;
                            mode: 'read';
                        }) => Promise<ResourceDirectoryHandle>;
                    };
                    if (!host.showDirectoryPicker) throw Error('当前浏览器不支持选择资源文件夹。');
                    return host.showDirectoryPicker({ id: 'visualizer-assets', mode: 'read' });
                });
            const handle = await picker();
            if (!this.current(task)) return;
            this.pending = handle;
            await this.loadHandle(handle, task, true);
        } catch (error) {
            this.failure(task, error);
        }
    }
    async recover() {
        if (this.disposed || !this.pending) return;
        const task = this.begin(),
            handle = this.pending;
        try {
            // Called directly from a visible button; never request permission during restore.
            if ((await handle.requestPermission({ mode: 'read' })) !== 'granted') {
                if (this.current(task))
                    this.publish({
                        ...this.settled,
                        status: 'permission',
                        canRestore: true,
                        message: '未获得资源文件夹的读取权限。',
                    });
                return;
            }
            if (this.current(task)) await this.loadHandle(handle, task, true);
        } catch (error) {
            this.failure(task, error);
        }
    }
    async reload() {
        const handle = this.active ?? this.pending;
        if (this.disposed || !handle) return;
        const task = this.begin();
        try {
            await this.loadHandle(handle, task, true);
        } catch (error) {
            this.failure(task, error);
        }
    }
    private async loadHandle(handle: ResourceDirectoryHandle, task: Task, persist: boolean) {
        const permission = await handle.queryPermission({ mode: 'read' });
        if (!this.current(task)) return;
        if (permission !== 'granted') {
            this.pending = handle;
            this.publish({
                ...this.settled,
                status: 'permission',
                canRestore: true,
                message: '请恢复资源文件夹的读取权限。',
            });
            return;
        }
        const candidate = await (this.options.read ?? readResourceDirectory)(handle, task.signal);
        task.signal.throwIfAborted();
        await (this.options.validate ?? validateRuntimeSnapshot)(candidate.resources, task.signal);
        if (!this.current(task)) return;
        const entries: ResourceLibraryState['entries'] = [];
        try {
            for (const entry of candidate.entries)
                entries.push({
                    info: entry.info,
                    previewUrl: entry.preview
                        ? (this.options.createUrl ?? URL.createObjectURL)(entry.preview)
                        : DEFAULT_RESOURCE_PREVIEW,
                });
        } catch (error) {
            this.release(entries);
            throw error;
        }
        const old = this.state.entries;
        this.registry.replace(candidate.resources);
        this.active = handle;
        this.pending = handle;
        this.publish({ ...candidate.resources, entries, status: 'ready', folderName: handle.name, canRestore: false });
        this.release(old);
        if (persist) {
            const save = this.writes.then(async () => {
                if (this.current(task)) await this.repository.save(handle);
            });
            this.writes = save.catch(() => {});
            try {
                await save;
            } catch {
                if (this.current(task))
                    this.publish({ ...this.state, message: '资源已加载，但无法记住文件夹；下次打开需重新选择。' });
            }
        }
    }
    private release(entries: ResourceLibraryState['entries']) {
        for (const e of entries)
            if (e.previewUrl !== DEFAULT_RESOURCE_PREVIEW)
                (this.options.revokeUrl ?? URL.revokeObjectURL)(e.previewUrl);
    }
    dispose() {
        this.disposed = true;
        this.generation++;
        this.task?.abort();
        this.task = null;
        this.release(this.state.entries);
        this.registry.replace({ algorithms: [], elements: [], presets: [] });
        this.listeners.clear();
        this.state = empty();
        this.settled = this.state;
        this.active = null;
        this.pending = null;
    }
}
