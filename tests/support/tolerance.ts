export const ABSOLUTE_TOLERANCE = 1e-6;
export const RELATIVE_TOLERANCE = 1e-5;

export function withinMeydaTolerance(actual: number, expected: number): boolean {
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
        return false;
    }
    const tolerance = Math.max(ABSOLUTE_TOLERANCE, Math.abs(expected) * RELATIVE_TOLERANCE);
    return Math.abs(actual - expected) <= tolerance;
}

export function assertMeydaValueClose(
    actual: number | readonly number[] | Float32Array,
    expected: number | readonly number[],
    label: string,
): void {
    if (typeof actual === 'number' && typeof expected === 'number') {
        if (!withinMeydaTolerance(actual, expected)) {
            throw new Error(`${label}: expected ${expected}, received ${actual}`);
        }
        return;
    }
    if (typeof actual === 'number' || typeof expected === 'number') {
        throw new TypeError(`${label}: scalar/vector shape mismatch`);
    }
    if (actual.length !== expected.length) {
        throw new RangeError(`${label}: expected length ${expected.length}, received ${actual.length}`);
    }
    for (let index = 0; index < actual.length; index += 1) {
        const actualValue = actual[index];
        const expectedValue = expected[index];
        if (actualValue === undefined || expectedValue === undefined) {
            throw new RangeError(`${label}[${index}]: missing value`);
        }
        if (!withinMeydaTolerance(actualValue, expectedValue)) {
            throw new Error(`${label}[${index}]: expected ${expectedValue}, received ${actualValue}`);
        }
    }
}
