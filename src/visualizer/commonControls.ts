import { findResource } from './elementRegistry';
import type { AlgorithmDefinition } from './algorithmTypes';
import { canonicalJson } from './resourceIdentity';
import { validateElementBinding } from './elementBindings';
import { defaultNumericTransform, compatibleAnalysisFeatures, createDefaultAnalysisBinding } from './bindingDefaults';
import { invalid, keys, record, text } from './projectValidation';
import type { CommonControl, CommonValue, ElementDefinition, PresetInstance } from './resourceTypes';
import type { ElementBinding, VisualizerElement, VisualizerProjectV5 } from './compositionTypes';
import type { VisualizerNumericTransformV1 } from './types';

const transformFields = [
    'inputMin',
    'inputMax',
    'outputMin',
    'outputMax',
    'clamp',
    'invert',
    'attackSeconds',
    'releaseSeconds',
] as const;
export function controlBinding(
    control: CommonControl,
    binding: ElementBinding,
    value: CommonValue,
    definition: ElementDefinition,
    algorithms: readonly AlgorithmDefinition[],
): ElementBinding {
    const parameter = definition.parameters.find(p => p.id === control.parameterId);
    if (!parameter) return invalid('共同参数不存在。');
    const kernel = findResource(algorithms, definition.algorithm).contract;
    let candidate: unknown;
    if (control.kind === 'value') {
        if (!kernel.sharedParameters.includes(parameter.id) || parameter.valueKind !== 'number')
            return invalid('样式参数不能作为预设共同参数。');
        candidate = { parameterId: parameter.id, source: { kind: 'constant', value } };
    } else if (control.kind === 'binding') {
        if (kernel.inputParameter !== parameter.id) return invalid('共同输入必须是内核声明的数据输入。');
        const v = record(value, '共同输入');
        keys(v, ['source'], ['transform']);
        candidate = { parameterId: parameter.id, ...v };
    } else {
        if (
            kernel.inputParameter !== parameter.id ||
            parameter.valueKind !== 'number' ||
            binding.source.kind !== 'analysis' ||
            !control.field ||
            !transformFields.includes(control.field)
        )
            return invalid('共同映射字段不可用。');
        candidate = {
            ...binding,
            transform: {
                ...(binding.transform ?? defaultNumericTransform(parameter, binding.source.featureId)),
                [control.field]: value,
            },
        };
    }
    return validateElementBinding(candidate, parameter);
}
export function commonValue(control: CommonControl, binding: ElementBinding, definition: ElementDefinition): unknown {
    if (control.kind === 'value') return binding.source.kind === 'constant' ? binding.source.value : null;
    if (control.kind === 'binding') {
        const { parameterId: _parameterId, ...value } = binding;
        return value;
    }
    const parameter = definition.parameters.find(p => p.id === binding.parameterId)!;
    return binding.source.kind === 'analysis'
        ? (binding.transform ?? defaultNumericTransform(parameter, binding.source.featureId))[control.field!]
        : null;
}
export function validateCommonControls(
    input: unknown,
    targets: Map<string, { definition: ElementDefinition; bindings: ElementBinding[] }>,
    algorithms: readonly AlgorithmDefinition[],
): CommonControl[] {
    if (!Array.isArray(input)) return invalid('共同参数必须为列表。');
    const ids = new Set<string>(),
        owned = new Set<string>();
    return input.map(entry => {
        const c = record(entry, '共同参数');
        keys(c, ['id', 'label', 'kind', 'parameterId', 'targets', 'value'], ['field']);
        if (!['value', 'binding', 'transform'].includes(String(c.kind))) return invalid('共同参数类型无效。');
        const id = text(c.id, '共同参数 ID');
        if (ids.has(id)) return invalid('共同参数 ID 重复。');
        ids.add(id);
        if (
            !Array.isArray(c.targets) ||
            !c.targets.length ||
            c.targets.some(t => typeof t !== 'string') ||
            new Set(c.targets).size !== c.targets.length
        )
            return invalid('共同参数目标无效。');
        if (
            c.kind === 'transform'
                ? !transformFields.includes(c.field as keyof VisualizerNumericTransformV1)
                : c.field !== undefined
        )
            return invalid('共同参数字段无效。');
        const control = {
            id,
            label: text(c.label, '共同参数名称'),
            kind: c.kind,
            parameterId: text(c.parameterId, 'parameterId'),
            targets: [...c.targets],
            value: structuredClone(c.value),
            ...(c.field ? { field: c.field } : {}),
        } as CommonControl;
        for (const target of control.targets) {
            const t = targets.get(target),
                binding = t?.bindings.find(b => b.parameterId === control.parameterId);
            if (!t || !binding) return invalid('共同参数引用了不存在的子元素或参数。');
            const bindingKey = target + ':' + control.parameterId;
            const key = bindingKey + ':' + (control.kind === 'transform' ? control.field : '*');
            // Separate mapping fields may be shared; a whole binding cannot have another owner.
            if (
                owned.has(key) ||
                owned.has(bindingKey + ':*') ||
                (control.kind !== 'transform' && [...owned].some(key => key.startsWith(bindingKey + ':')))
            )
                return invalid('共同参数不能重叠控制同一字段。');
            owned.add(key);
            const parameter = t.definition.parameters.find(p => p.id === control.parameterId)!;
            const probe =
                control.kind === 'transform' && binding.source.kind !== 'analysis'
                    ? (createDefaultAnalysisBinding(
                          parameter,
                          compatibleAnalysisFeatures(parameter)[0]!,
                      ) as ElementBinding)
                    : binding;
            controlBinding(control, probe, control.value, t.definition, algorithms);
        }
        return control;
    });
}
export function changedControlElements(project: VisualizerProjectV5, control: CommonControl): VisualizerElement[] {
    return control.targets.flatMap(id => {
        const element = project.elements.find(e => e.id === id);
        if (!element) return [];
        const definition = project.resources.elements.find(
            d =>
                d.hash === element.resource.hash &&
                d.id === element.resource.id &&
                d.version === element.resource.version,
        )!;
        const binding = element.bindings.find(b => b.parameterId === control.parameterId)!;
        return canonicalJson(commonValue(control, binding, definition)) === canonicalJson(control.value)
            ? []
            : [element];
    });
}
export function applyCommonControl(
    project: VisualizerProjectV5,
    preset: PresetInstance,
    id: string,
    value: CommonValue,
): VisualizerProjectV5 {
    const result = structuredClone(project),
        group = result.items.find(i => i.kind === 'preset' && i.id === preset.id);
    if (group?.kind !== 'preset') return invalid('预设不存在。');
    const control = group.controls.find(c => c.id === id);
    if (!control) return invalid('共同参数不存在。');
    for (const target of control.targets) {
        const e = result.elements.find(e => e.id === target)!;
        const definition = result.resources.elements.find(
            d => d.hash === e.resource.hash && d.id === e.resource.id && d.version === e.resource.version,
        )!;
        e.bindings = e.bindings.map(b =>
            b.parameterId === control.parameterId
                ? controlBinding(control, b, value, definition, project.resources.algorithms)
                : b,
        );
    }
    control.value = structuredClone(value);
    return result;
}
