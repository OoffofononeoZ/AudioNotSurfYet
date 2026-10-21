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
