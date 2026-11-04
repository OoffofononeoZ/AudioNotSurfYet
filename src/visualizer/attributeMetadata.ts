import { invalid } from './projectValidation';

/** Display-only metadata. Preserve the exact text used in the resource identity. */
export function tooltipField(value: unknown): { tooltip?: string } {
    if (value === undefined) return {};
    if (typeof value !== 'string') return invalid('属性 tooltip 必须为字符串。');
    return { tooltip: value };
}
