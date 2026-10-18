import { elementRegistry, type ElementRegistry } from './elementRegistry';
import { canonicalJson } from './resourceIdentity';
import { mergeResources, validateResourcePackage, validateResourceSnapshot } from './resourceCodec';
import { ResourceRepository, type ResourceRepositoryPort } from './resourceRepository';
import { keys, record } from './projectValidation';
import type { ResourceSnapshot, VisualizerResourcePackageV1 } from './resourceTypes';

export interface ResourceLibraryState extends ResourceSnapshot {
    status: 'idle' | 'loading' | 'ready' | 'error';
    message?: string;
    imported: VisualizerResourcePackageV1[];
}
const empty = (): ResourceSnapshot => ({ elements: [], presets: [] });
/** Sources share validation and registration; none can mutate a project's embedded definitions. */
export class VisualizerResourceLibrary {
    private state: ResourceLibraryState = { ...empty(), status: 'idle', imported: [] };
    private builtin: VisualizerResourcePackageV1[] = [];
    private task: AbortController | null = null;
    private generation = 0;
    private listeners = new Set<(state: ResourceLibraryState) => void>();
    private repository: ResourceRepositoryPort;
    private request: typeof fetch;
    private registry: ElementRegistry;
    private base: string;
    constructor(
        repository: ResourceRepositoryPort = new ResourceRepository(),
        request: typeof fetch = fetch,
        registry: ElementRegistry = elementRegistry,
        base = '/visualizer-resources/v1/',
    ) {
        this.repository = repository;
        this.request = request.bind(globalThis);
        this.registry = registry;
        this.base = base;
    }
    subscribe(listener: (state: ResourceLibraryState) => void) {
        this.listeners.add(listener);
        listener(this.snapshot());
        return () => this.listeners.delete(listener);
    }
    snapshot() {
        return structuredClone(this.state);
    }
    private publish(state: ResourceLibraryState) {
        this.state = state;
        for (const listener of this.listeners) listener(this.snapshot());
    }
    private resolve(
        raw: unknown[],
        builtin: VisualizerResourcePackageV1[] = this.builtin,
    ): VisualizerResourcePackageV1[] {
        const all = [...builtin, ...raw].map(input => record(input, '资源包'));
        const combined = validateResourceSnapshot({
            elements: all.flatMap(p => (Array.isArray(p.elements) ? p.elements : [])),
            presets: all.flatMap(p => (Array.isArray(p.presets) ? p.presets : [])),
        });
        const packages = raw.map(input => validateResourcePackage(input, combined));
        const identities = new Map<string, string>();
        for (const pack of [...builtin, ...packages]) {
            const key = pack.id + '@' + pack.version,
                content = canonicalJson(pack),
                prior = identities.get(key);
            if (prior && prior !== content) throw Error('资源包 ID 与版本冲突。');
            identities.set(key, content);
        }
        return [...new Map(packages.map(p => [p.id + '@' + p.version, p])).values()];
    }
    private register(imported: VisualizerResourcePackageV1[]) {
        const resources = mergeResources(...this.builtin, ...imported);
        this.registry.replace(resources);
        this.publish({ ...resources, status: 'ready', imported });
    }
    async load() {
        this.task?.abort();
        const task = new AbortController(),
            generation = ++this.generation;
        this.task = task;
        this.publish({ ...this.state, status: 'loading', message: undefined });
        try {
            const response = await this.request(this.base + 'catalog.json', { signal: task.signal });
            if (!response.ok) throw Error('资源索引加载失败。');
            const index = record(await response.json(), '资源索引');
            keys(index, ['format', 'schemaVersion', 'packages']);
            task.signal.throwIfAborted();
            if (
                index.format !== 'audiosurf-visualizer-catalog' ||
                index.schemaVersion !== 1 ||
                !Array.isArray(index.packages) ||
                index.packages.some(p => typeof p !== 'string' || !/^((elements|presets)\/[a-z0-9._-]+\.json)$/.test(p))
            )
                throw Error('资源索引格式无效。');
            const raw = await Promise.all(
                (index.packages as string[]).map(async path => {
                    const r = await this.request(this.base + path, { signal: task.signal });
                    if (!r.ok) throw Error('资源加载失败：' + path);
                    return r.json() as Promise<unknown>;
                }),
            );
            const builtin = this.resolve(raw, []),
                imported = this.resolve(await this.repository.read(), builtin);
            if (generation !== this.generation || task.signal.aborted) return;
            this.builtin = builtin;
            this.register(imported);
        } catch (error) {
            if (generation !== this.generation || task.signal.aborted) return;
            this.publish({ ...this.state, status: 'error', message: (error as Error).message });
        }
    }
    private async commit(raw: unknown[]) {
        if (this.state.status === 'loading') throw Error('资源正在加载，请稍后重试。');
        this.task?.abort();
        const task = new AbortController(),
            generation = ++this.generation;
        this.task = task;
        const packages = this.resolve(raw);
        await this.repository.write(packages, task.signal);
        if (generation !== this.generation || task.signal.aborted) return;
        this.register(packages);
    }
    async import(bytes: ArrayBuffer) {
        const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        const candidate = this.resolve([...this.state.imported, input]);
        if (canonicalJson(candidate) === canonicalJson(this.state.imported)) return;
        await this.commit(candidate);
    }
    async remove(id: string, version: number) {
        await this.commit(this.state.imported.filter(p => p.id !== id || p.version !== version));
    }
    dispose() {
        this.generation++;
        this.task?.abort();
        this.task = null;
        this.listeners.clear();
        this.repository.close();
    }
}
