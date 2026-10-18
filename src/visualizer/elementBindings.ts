import { canonicalBinding, invalid, keys, record } from './projectValidation';
import type { ElementBinding } from './compositionTypes';
import type { SceneParameterDescriptor } from './parameterDescriptor';

/** Shared strict binding validation for packages, embedded definitions and project instances. */
export function validateElementBinding(input: unknown, p: SceneParameterDescriptor): ElementBinding {
    const b = record(input, 'binding'),
        source = record(b.source, 'source');
    if (source.kind === 'unbound') {
        keys(b, ['parameterId', 'source']);
        keys(source, ['kind']);
        if (b.parameterId !== p.id || !p.allowedSourceKinds.includes('analysis'))
            return invalid('此参数不能处于未绑定状态。');
        return { parameterId: p.id, source: { kind: 'unbound' } };
    }
    if (source.kind === 'native') {
        keys(b, ['parameterId', 'source']);
        keys(source, ['kind', 'featureId']);
        if (
            b.parameterId !== p.id ||
            p.valueKind !== 'vector' ||
            !p.allowedSourceKinds.includes('native') ||
            (source.featureId !== 'frequency' && source.featureId !== 'waveform')
        )
            return invalid('原生输入特征或参数无效。');
        return {
            parameterId: p.id,
            source: { kind: 'native', featureId: source.featureId as 'frequency' | 'waveform' },
        };
    }
    if (source.kind !== 'constant' && source.kind !== 'analysis')
        return invalid('只支持固定值、原曲 Analyzer 或原生输入。');
    return canonicalBinding(b, p, undefined, 'binding') as ElementBinding;
}
export function validateElementBindings(
    input: unknown,
    parameters: readonly SceneParameterDescriptor[],
): ElementBinding[] {
    if (!Array.isArray(input) || input.length !== parameters.length) return invalid('元素参数不完整。');
    return parameters.map((parameter, index) => validateElementBinding(input[index], parameter));
}
