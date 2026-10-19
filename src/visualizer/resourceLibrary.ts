import { elementRegistry, type ElementRegistry } from './elementRegistry';
import { mergeResources, validateResourcePackage, validateResourceSnapshot } from './resourceCodec';
import { record, keys } from './projectValidation';
import { validateRuntimeSnapshot } from './validateRuntimeSnapshot';
import type { ResourceSnapshot } from './resourceTypes';
export interface ResourceLibraryState extends ResourceSnapshot {
    status: 'idle' | 'loading' | 'ready' | 'error';
    message?: string;
}
const empty = (): ResourceSnapshot => ({ algorithms: [], elements: [], presets: [] });
/** Only the project-owned catalog is a library source. Project snapshots stay independent. */
export class VisualizerResourceLibrary {
    private state: ResourceLibraryState = { ...empty(), status: 'idle' };
    private task: AbortController | null = null;
    private generation = 0;
    private listeners = new Set<(state: ResourceLibraryState) => void>();
    private request: typeof fetch;
    private registry: ElementRegistry;
    private base: string;
    private validate: typeof validateRuntimeSnapshot;
    constructor(
        request: typeof fetch = fetch,
        registry: ElementRegistry = elementRegistry,
        base = '/visualizer-resources/v2/',
        validate = validateRuntimeSnapshot,
    ) {
        this.request = request.bind(globalThis);
        this.registry = registry;
        this.base = base;
        this.validate = validate;
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
                index.schemaVersion !== 2 ||
                !Array.isArray(index.packages) ||
                index.packages.some(p => typeof p !== 'string' || !/^[a-z0-9._-]+\.json$/.test(p))
            )
                throw Error('资源索引格式无效。');
            const raw = await Promise.all(
                (index.packages as string[]).map(async path => {
                    const response = await this.request(this.base + path, { signal: task.signal });
                    if (!response.ok) throw Error('资源加载失败：' + path);
                    return record(await response.json(), '资源包');
                }),
            );
            const combined = validateResourceSnapshot({
                algorithms: raw.flatMap(p => (Array.isArray(p.algorithms) ? p.algorithms : [])),
                elements: raw.flatMap(p => (Array.isArray(p.elements) ? p.elements : [])),
                presets: raw.flatMap(p => (Array.isArray(p.presets) ? p.presets : [])),
            });
            const packages = raw.map(p => validateResourcePackage(p, combined));
            const identities = new Map<string, string>();
            for (const pack of packages) {
                const key = pack.id + '@' + pack.version,
                    content = JSON.stringify(pack);
                if (identities.has(key) && identities.get(key) !== content) throw Error('资源包 ID 与版本冲突。');
                identities.set(key, content);
            }
            const resources = mergeResources(...packages);
            task.signal.throwIfAborted();
            await this.validate(resources, task.signal);
            if (generation !== this.generation || task.signal.aborted) return;
            this.registry.replace(resources);
            this.publish({ ...resources, status: 'ready' });
        } catch (error) {
            if (generation !== this.generation || task.signal.aborted) return;
            this.publish({ ...this.state, status: 'error', message: (error as Error).message });
        }
    }
    dispose() {
        this.generation++;
        this.task?.abort();
        this.task = null;
        this.listeners.clear();
    }
}
