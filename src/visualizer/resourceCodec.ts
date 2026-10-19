import { validateAlgorithmDefinition } from './algorithmCodec';
import type { AlgorithmDefinition } from './algorithmTypes';
import { validateElementBinding, validateElementBindings } from './elementBindings';
import { commonValue, validateCommonControls } from './commonControls';
import { canonicalJson, resourceHash, resourceKey, sameResource } from './resourceIdentity';
import { finite, integer, invalid, keys, record, text } from './projectValidation';
import type { SceneParameterDescriptor } from './parameterDescriptor';
import type {
    ElementDefinition,
    PresetDefinition,
    ResourceRef,
    ResourceSnapshot,
    VisualizerResourcePackageV2,
} from './resourceTypes';
import { roundEditingValue } from '../utils/numberEditing';

const icons = [
    'square',
    'strings',
    'dots',
    'rings',
    'radial',
    'orbit',
    'wireform',
    'arcs',
    'tunnel',
    'stars',
    'scale',
    'blur',
    'fade',
];
const name = (input: unknown) => {
    const value = text(input, '资源 ID');
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) return invalid('资源 ID 格式无效。');
    return value;
};
const version = (input: unknown) => {
    const value = integer(input, '资源版本');
    if (value < 1 || !Number.isSafeInteger(value)) return invalid('资源版本无效。');
    return value;
};
export function validateResourceRef(input: unknown): ResourceRef {
    const v = record(input, '资源引用');
    keys(v, ['id', 'version', 'hash']);
    if (typeof v.hash !== 'string' || !/^[a-f0-9]{64}$/.test(v.hash)) return invalid('资源 SHA-256 无效。');
    return { id: name(v.id), version: version(v.version), hash: v.hash };
}
function identity(v: Record<string, unknown>): ResourceRef {
    const ref = validateResourceRef({ id: v.id, version: v.version, hash: v.hash });
    if (resourceHash(v) !== ref.hash) return invalid('资源内容与 SHA-256 不匹配。');
    return ref;
}
function assertDefaultPrecision(value: unknown, parameter: SceneParameterDescriptor) {
    if (
        parameter.valueKind === 'number' &&
        typeof value === 'number' &&
        roundEditingValue(value, parameter.range?.editingPrecision ?? (parameter.range?.integer ? 0 : 2)) !== value
    )
        return invalid('资源默认常量须遵守声明的编辑精度。');
}
function parameter(
    input: unknown,
    contract: Omit<SceneParameterDescriptor, 'label' | 'defaultValue' | 'defaultBinding'>,
): SceneParameterDescriptor {
    const v = record(input, '参数定义');
    keys(
        v,
        ['id', 'label', 'valueKind', 'defaultValue', 'allowedSourceKinds'],
        [
            'range',
            'vectorElementRange',
            'allowEmptyVector',
            'allowedAnalysisComponents',
            'allowedAnalysisProjections',
            'defaultBinding',
        ],
    );
    if (v.id !== contract.id || v.valueKind !== contract.valueKind) return invalid('参数与绘制内核不匹配。');
    text(v.label, '参数标签');
    for (const field of ['allowedSourceKinds', 'allowedAnalysisComponents', 'allowedAnalysisProjections'] as const) {
        const values = v[field],
            allowed = contract[field];
        if (values === undefined && allowed === undefined) continue;
        if (
            !Array.isArray(values) ||
            !values.length ||
            !allowed ||
            new Set(values).size !== values.length ||
            values.some(value => !allowed.includes(value as never))
        )
            return invalid('参数声明了内核不支持的输入能力。');
    }
    for (const field of ['range', 'vectorElementRange'] as const) {
        const permitted = contract[field];
        if (!permitted) {
            if (v[field] !== undefined) return invalid('内核未声明此参数范围。');
            continue;
        }
        const range = record(v[field], field);
        keys(range, ['min', 'max'], ['integer', 'editingPrecision']);
        const min = finite(range.min, 'min'),
            max = finite(range.max, 'max');
        if (min < permitted.min || max > permitted.max || min > max || range.integer !== permitted.integer)
            return invalid('参数范围超出内核约束。');
        if (
            range.editingPrecision !== undefined &&
            (!Number.isInteger(range.editingPrecision) ||
                Number(range.editingPrecision) < 0 ||
                Number(range.editingPrecision) > 100)
        )
            return invalid('参数编辑精度无效。');
    }
    if (v.allowEmptyVector !== contract.allowEmptyVector) return invalid('向量约束与内核不符。');
    const result = structuredClone(v) as unknown as SceneParameterDescriptor;
    assertDefaultPrecision(result.defaultValue, result);
    validateElementBinding(
        { parameterId: result.id, source: { kind: 'constant', value: result.defaultValue } },
        { ...result, allowedSourceKinds: ['constant'] },
    );
    if (v.defaultBinding !== undefined) {
        const binding = record(v.defaultBinding, '默认绑定');
        keys(binding, ['source'], ['transform']);
        const validated = validateElementBinding({ parameterId: result.id, ...binding }, result);
        if (validated.source.kind === 'constant') assertDefaultPrecision(validated.source.value, result);
    }
    return result;
}
function elementDefinition(input: unknown, algorithms: AlgorithmDefinition[]): ElementDefinition {
    const v = record(input, '元素定义');
    keys(v, ['id', 'version', 'hash', 'algorithm', 'kind', 'title', 'icon', 'parameters'], ['inputParameter']);
    const ref = identity(v);
    const algorithm = validateResourceRef(v.algorithm),
        definition = algorithms.find(a => sameResource(a, algorithm));
    if (!definition) return invalid('绘制算法依赖缺失。');
    const kernel = definition.contract;
    if (v.kind !== kernel.kind || v.inputParameter !== kernel.inputParameter || !icons.includes(String(v.icon)))
        return invalid('元素种类、输入或图标无效。');
    if (!Array.isArray(v.parameters) || v.parameters.length !== kernel.parameters.length)
        return invalid('元素参数定义不完整。');
    return {
        ...ref,
        algorithm,
        kind: kernel.kind,
        title: text(v.title, '元素名称'),
        icon: String(v.icon),
        ...(kernel.inputParameter ? { inputParameter: kernel.inputParameter } : {}),
        parameters: kernel.parameters.map((p, i) => parameter((v.parameters as unknown[])[i], p)),
    };
}
export function mergeResources(...snapshots: ResourceSnapshot[]): ResourceSnapshot {
    const result: ResourceSnapshot = { algorithms: [], elements: [], presets: [] };
    for (const field of ['algorithms', 'elements', 'presets'] as const) {
        const entries = new Map<string, ResourceRef>();
        for (const snapshot of snapshots)
            for (const definition of snapshot[field]) {
                const key = definition.id + '@' + definition.version,
                    existing = entries.get(key);
                if (existing && !sameResource(existing, definition))
                    return invalid('同一资源 ID 与版本对应了不同内容。');
                entries.set(key, definition);
            }
        Object.assign(result, { [field]: [...entries.values()] });
    }
    return result;
}
function presetDefinition(
    input: unknown,
    elements: ElementDefinition[],
    algorithms: AlgorithmDefinition[],
): PresetDefinition {
    const v = record(input, '预设定义');
    keys(v, ['id', 'version', 'hash', 'title', 'description', 'preview', 'elements', 'controls']);
    const ref = identity(v);
    if (!['geometric', 'cinematic'].includes(String(v.preview))) return invalid('预设预览类型无效。');
    if (!Array.isArray(v.elements) || !v.elements.length) return invalid('预设至少包含一个元素。');
    const targets = new Map<
        string,
        { definition: ElementDefinition; bindings: ReturnType<typeof validateElementBindings> }
    >();
    const templates = v.elements.map(input => {
        const e = record(input, '预设子元素');
        keys(e, ['key', 'element', 'name', 'enabled', 'bindings', 'timing'], ['targets']);
        const key = name(e.key),
            element = validateResourceRef(e.element),
            definition = elements.find(d => sameResource(d, element));
        if (!definition) return invalid('预设缺少精确版本的元素依赖：' + resourceKey(element));
        if (targets.has(key) || typeof e.enabled !== 'boolean') return invalid('预设子元素 key 或启用状态无效。');
        const bindings = validateElementBindings(e.bindings, definition.parameters);
        for (const [index, binding] of bindings.entries())
            if (binding.source.kind === 'constant')
                assertDefaultPrecision(binding.source.value, definition.parameters[index]!);
        targets.set(key, { definition, bindings });
        const t = record(e.timing, '预设时间');
        if (definition.kind === 'transition') {
            keys(t, ['kind']);
            if (t.kind !== 'unbound') return invalid('预设转场须待选择范围。');
        } else {
            keys(t, ['kind', 'start', 'end']);
            if (
                t.kind !== 'relative' ||
                finite(t.start, 'start') < 0 ||
                finite(t.end, 'end') > 1 ||
                Number(t.start) >= Number(t.end)
            )
                return invalid('预设相对时间无效。');
        }
        return {
            key,
            element,
            name: text(e.name, '子元素名称'),
            enabled: e.enabled,
            bindings,
            timing: structuredClone(t),
            ...(e.targets !== undefined ? { targets: structuredClone(e.targets) } : {}),
        };
    }) as PresetDefinition['elements'];
    for (const e of templates) {
        const definition = targets.get(e.key)!.definition;
        if (definition.kind === 'visual') {
            if (e.targets !== undefined) return invalid('视觉元素不能声明效果目标。');
            continue;
        }
        const target = record(e.targets, '预设效果目标');
        if (target.kind === 'composition') keys(target, ['kind']);
        else {
            keys(target, ['kind', 'ids']);
            if (
                target.kind !== 'elements' ||
                !Array.isArray(target.ids) ||
                new Set(target.ids).size !== target.ids.length ||
                target.ids.some(id => targets.get(String(id))?.definition.kind !== 'visual')
            )
                return invalid('预设内部效果引用无效。');
        }
    }
    const controls = validateCommonControls(v.controls, targets, algorithms);
    for (const control of controls)
        for (const key of control.targets) {
            const t = targets.get(key)!;
            if (
                canonicalJson(
                    commonValue(
                        control,
                        t.bindings.find(b => b.parameterId === control.parameterId)!,
                        t.definition,
                    ),
                ) !== canonicalJson(control.value)
            )
                return invalid('预设共同值与默认子元素配置不一致。');
        }
    const features = new Set(
        templates.flatMap(e => e.bindings.flatMap(b => (b.source.kind === 'analysis' ? [b.source.featureId] : []))),
    );
    if (features.size > 4) return invalid('一个预设最多使用四个不同的 Analyzer 特征。');
    return {
        ...ref,
        title: text(v.title, '预设名称'),
        description: text(v.description, '预设说明'),
        preview: v.preview as PresetDefinition['preview'],
        elements: templates,
        controls,
    };
}
export function validateResourceSnapshot(
    input: unknown,
    base: ResourceSnapshot = { algorithms: [], elements: [], presets: [] },
): ResourceSnapshot {
    const v = record(input, '资源快照');
    keys(v, ['algorithms', 'elements', 'presets']);
    if (!Array.isArray(v.elements) || !Array.isArray(v.presets)) return invalid('资源定义必须为列表。');
    if (!Array.isArray(v.algorithms)) return invalid('算法定义必须为列表。');
    const algorithms = v.algorithms.map(validateAlgorithmDefinition);
    const combined = mergeResources(base, { algorithms, elements: [], presets: [] });
    const elements = v.elements.map(e => elementDefinition(e, combined.algorithms));
    const all = mergeResources(combined, { algorithms: [], elements, presets: [] });
    const presets = v.presets.map(p => presetDefinition(p, all.elements, all.algorithms));
    mergeResources(all, { algorithms: [], elements: [], presets });
    return { algorithms, elements, presets };
}
export function validateResourcePackage(input: unknown, base?: ResourceSnapshot): VisualizerResourcePackageV2 {
    const v = record(input, '资源包');
    keys(v, ['format', 'schemaVersion', 'id', 'version', 'algorithms', 'elements', 'presets']);
    if (v.format !== 'audiosurf-visualizer-resource' || v.schemaVersion !== 2)
        return invalid('资源包格式或版本不支持。');
    const snapshot = validateResourceSnapshot(
        { algorithms: v.algorithms, elements: v.elements, presets: v.presets },
        base,
    );
    if (!snapshot.elements.length && !snapshot.presets.length) return invalid('资源包不能为空。');
    return {
        format: 'audiosurf-visualizer-resource',
        schemaVersion: 2,
        id: name(v.id),
        version: version(v.version),
        ...snapshot,
    };
}
export const decodeResourcePackage = (bytes: ArrayBuffer, base?: ResourceSnapshot) =>
    validateResourcePackage(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), base);
export const resourceFileFormat = { extension: '.json', mimeType: 'application/json' } as const;
