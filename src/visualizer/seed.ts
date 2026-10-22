import { integer, invalid } from './projectValidation';

/** null requests a fresh session seed instead of being coerced to a fixed zero. */
export function validateSeed(input: unknown): number | null {
    if (input === null) return null;
    const seed = integer(input, 'seed');
    if (seed < 0 || seed > 0xffffffff) return invalid('Seed 超出范围。');
    return seed;
}

export function resolveSessionSeed(seed: number | null): number {
    return seed ?? crypto.getRandomValues(new Uint32Array(1))[0]!;
}

export function elementSeedField(input: unknown, usesSeed?: true): { seed?: number | null } {
    if (usesSeed) return { seed: validateSeed(input) };
    if (input !== undefined) return invalid('此元素不使用 Seed。');
    return {};
}

/** Owns only seeded elements; immutable snapshots also invalidate in-flight frames. */
export class ElementSeedSession {
    private configured = new Map<string, number | null>();
    private snapshot: ReadonlyMap<string, number> = new Map();
    get values() {
        return this.snapshot;
    }
    sync(elements: readonly { id: string; seed?: number | null }[], reset = false) {
        const configured = new Map<string, number | null>(),
            values = new Map<string, number>();
        let changed = reset;
        for (const e of elements) {
            if (e.seed === undefined) continue;
            const seed = validateSeed(e.seed);
            configured.set(e.id, seed);
            const retained = !reset && this.configured.has(e.id) && this.configured.get(e.id) === seed;
            values.set(e.id, retained ? this.snapshot.get(e.id)! : resolveSessionSeed(seed));
            if (!retained) changed = true;
        }
        if (configured.size !== this.configured.size) changed = true;
        this.configured = configured;
        if (changed) this.snapshot = values;
        return this.snapshot;
    }
    clear() {
        this.configured.clear();
        this.snapshot = new Map();
    }
}
