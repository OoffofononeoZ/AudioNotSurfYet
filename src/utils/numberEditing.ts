/** UI precision is declared by the field, independently of its current value. */
export const numberEditingStep = (precision: number): number =>
    precision === 0 ? 1 : 10 ** -(Math.max(2, precision) - 1);

export const roundEditingValue = (value: number, precision: number): number =>
    Number(value.toFixed(precision));

export interface NumberStepOptions {
    precision: number;
    min?: number;
    max?: number;
    isValid?: (value: number) => boolean;
}

/** Step from the entered value, without snapping it to the native input grid. */
export function stepEditedNumber(current: number, fallback: number, direction: 1 | -1, options: NumberStepOptions): number {
    const value = Number.isFinite(current) ? current : fallback;
    const next = Math.max(options.min ?? -Infinity, Math.min(options.max ?? Infinity,
        roundEditingValue(value + direction * numberEditingStep(options.precision), options.precision)));
    if (!Number.isFinite(next) || options.isValid?.(next) === false) return value;
    return Object.is(next, -0) ? 0 : next;
}
