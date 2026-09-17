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

export interface MeydaToleranceMismatch {
    path: string;
    expected: number;
    actual: number;
    deviation: number;
    allowed: number;
}

/**
 * 递归比较 golden 结构：数值按固定 Meyda 容差（绝对 1e-6、相对 1e-5）判断，
 * 维度、键集与字符串/布尔/null 仍要求完全一致。
 * 允许跨平台 ULP 级浮点差异，但任何超出容差的数值或结构变化都会成为 mismatch。
 */
export function collectMeydaToleranceMismatches(
    actual: unknown,
    expected: unknown,
    path = '$',
    mismatches: MeydaToleranceMismatch[] = [],
    limit = 8,
): MeydaToleranceMismatch[] {
    if (mismatches.length >= limit) {
        return mismatches;
    }
    if (typeof actual === 'number' && typeof expected === 'number') {
        if (!withinMeydaTolerance(actual, expected)) {
            mismatches.push({
                path,
                expected,
                actual,
                deviation: Math.abs(actual - expected),
                allowed: Math.max(
                    ABSOLUTE_TOLERANCE,
                    Math.abs(expected) * RELATIVE_TOLERANCE,
                ),
            });
        }
        return mismatches;
    }
    if (Array.isArray(actual) || Array.isArray(expected)) {
        if (!Array.isArray(actual) || !Array.isArray(expected)) {
            throw new TypeError(`${path}: expected array shape to match`);
        }
        if (actual.length !== expected.length) {
            throw new RangeError(
                `${path}: expected length ${expected.length}, received ${actual.length}`,
            );
        }
        for (let index = 0; index < actual.length; index += 1) {
            collectMeydaToleranceMismatches(
                actual[index],
                expected[index],
                `${path}[${index}]`,
                mismatches,
                limit,
            );
        }
        return mismatches;
    }
    if (
        actual !== null
        && expected !== null
        && typeof actual === 'object'
        && typeof expected === 'object'
    ) {
        const actualRecord = actual as Record<string, unknown>;
        const expectedRecord = expected as Record<string, unknown>;
        for (const key of new Set([
            ...Object.keys(expectedRecord),
            ...Object.keys(actualRecord),
        ])) {
            if (!(key in expectedRecord) || !(key in actualRecord)) {
                throw new Error(`${path}.${key}: key set mismatch`);
            }
            collectMeydaToleranceMismatches(
                actualRecord[key],
                expectedRecord[key],
                `${path}.${key}`,
                mismatches,
                limit,
            );
        }
        return mismatches;
    }
    if (actual !== expected) {
        throw new Error(
            `${path}: expected ${String(expected)}, received ${String(actual)}`,
        );
    }
    return mismatches;
}

export function describeMeydaToleranceMismatches(
    mismatches: readonly MeydaToleranceMismatch[],
): string {
    if (mismatches.length === 0) {
        return 'no mismatches';
    }
    return mismatches
        .map((mismatch) =>
            `${mismatch.path}: expected ${mismatch.expected}, `
            + `received ${mismatch.actual} `
            + `(deviation ${mismatch.deviation}, allowed ${mismatch.allowed})`,
        )
        .join('\n');
}
