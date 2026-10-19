import { finite, integer, invalid, keys, record, text } from './projectValidation';
import { resourceHash } from './resourceIdentity';
import type {
    AlgorithmContract,
    AlgorithmDefinition,
    AlgorithmParameter,
    ShaderProgram,
    UniformType,
} from './algorithmTypes';

const identifier = (value: unknown) => {
    const id = text(value, '算法标识');
    if (!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(id)) invalid('算法标识无效。');
    return id;
};
const list = (value: unknown, allowed?: readonly string[]): string[] => {
    if (!Array.isArray(value) || new Set(value).size !== value.length) return invalid('算法能力列表无效。');
    return value.map(v => {
        const id = identifier(v);
        if (allowed && !allowed.includes(id)) invalid('算法声明了不支持的能力。');
        return id;
    });
};
function range(input: unknown) {
    const v = record(input, '算法参数范围');
    keys(v, ['min', 'max'], ['integer', 'editingPrecision']);
    if (finite(v.min, 'min') > finite(v.max, 'max')) invalid('算法参数范围无效。');
    if (v.integer !== undefined && typeof v.integer !== 'boolean') invalid('算法整数声明无效。');
    if (
        v.editingPrecision !== undefined &&
        (!Number.isInteger(v.editingPrecision) || Number(v.editingPrecision) < 0 || Number(v.editingPrecision) > 100)
    )
        invalid('算法编辑精度无效。');
}
function parameter(input: unknown): AlgorithmParameter {
    const v = record(input, '算法参数');
    keys(
        v,
        ['id', 'valueKind', 'allowedSourceKinds'],
        ['range', 'vectorElementRange', 'allowEmptyVector', 'allowedAnalysisComponents', 'allowedAnalysisProjections'],
    );
    identifier(v.id);
    if (!['number', 'boolean', 'color', 'vector'].includes(String(v.valueKind))) invalid('算法参数类型无效。');
    if (!list(v.allowedSourceKinds, ['constant', 'analysis', 'native']).length) invalid('算法缺少输入能力。');
    if (v.range !== undefined) {
        if (v.valueKind !== 'number') invalid('仅数值参数支持范围。');
        range(v.range);
    }
    if (v.vectorElementRange !== undefined) {
        if (v.valueKind !== 'vector') invalid('仅向量支持分量范围。');
        range(v.vectorElementRange);
    }
    if (v.allowEmptyVector !== undefined && (v.valueKind !== 'vector' || typeof v.allowEmptyVector !== 'boolean'))
        invalid('算法向量声明无效。');
    if (v.allowedAnalysisComponents !== undefined)
        list(v.allowedAnalysisComponents, ['default', 'total', 'specific', 'real', 'imag', 'magnitude', 'phase']);
    if (v.allowedAnalysisProjections !== undefined)
        list(v.allowedAnalysisProjections, ['scalar', 'mean', 'max', 'peak', 'bin', 'band', 'full']);
    return structuredClone(v) as unknown as AlgorithmParameter;
}
export function validateAlgorithmContract(input: unknown): AlgorithmContract {
    const v = record(input, '算法契约');
    keys(v, ['kind', 'parameters', 'sharedParameters', 'historyParameters'], ['inputParameter']);
    if (!['visual', 'modifier', 'transition'].includes(String(v.kind)) || !Array.isArray(v.parameters))
        return invalid('算法种类或参数无效。');
    const parameters = v.parameters.map(parameter),
        ids = parameters.map(p => p.id);
    if (new Set(ids).size !== ids.length) invalid('算法参数重复。');
    if (v.inputParameter !== undefined && !ids.includes(identifier(v.inputParameter))) invalid('算法输入参数不存在。');
    const sharedParameters = list(v.sharedParameters, ids),
        historyParameters = list(v.historyParameters, ids);
    if (sharedParameters.some(id => parameters.find(p => p.id === id)?.valueKind !== 'number'))
        invalid('共同处理参数必须为数值。');
    return {
        kind: v.kind as AlgorithmContract['kind'],
        parameters,
        sharedParameters,
        historyParameters,
        ...(v.inputParameter !== undefined ? { inputParameter: String(v.inputParameter) } : {}),
    };
}
export function validateShaderProgram(input: unknown): ShaderProgram {
    const v = record(input, 'Shader');
    keys(v, ['vertex', 'fragment', 'geometry', 'uniforms']);
    text(v.vertex, 'vertex');
    text(v.fragment, 'fragment');
    if (!['quad', 'triangles'].includes(String(v.geometry))) invalid('Shader 几何类型无效。');
    const uniforms = record(v.uniforms, 'uniforms');
    for (const [name, raw] of Object.entries(uniforms)) {
        identifier(name);
        const u = record(raw, 'uniform');
        keys(u, ['type'], ['length']);
        if (!['number', 'int', 'boolean', 'color', 'vec2', 'vec3', 'array', 'source'].includes(String(u.type)))
            invalid('uniform 类型无效。');
        if (u.type === 'array') {
            const length = integer(u.length, 'uniform length');
            if (length < 1 || length > 65536) invalid('uniform 数组长度无效。');
        } else if (u.length !== undefined) invalid('仅数组 uniform 支持长度。');
    }
    return structuredClone(v) as unknown as ShaderProgram;
}
export function validateAlgorithmDefinition(input: unknown): AlgorithmDefinition {
    const v = record(input, '算法定义');
    keys(v, ['id', 'version', 'hash', 'apiVersion', 'contract', 'source', 'programs']);
    const id = text(v.id, '算法 ID'),
        version = integer(v.version, '算法版本');
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(id) || version < 1 || !Number.isSafeInteger(version)) invalid('算法身份无效。');
    if (v.apiVersion !== 1) invalid('算法 ABI 不受支持。');
    if (typeof v.hash !== 'string' || !/^[a-f0-9]{64}$/.test(v.hash) || resourceHash(v) !== v.hash)
        invalid('算法内容与 SHA-256 不匹配。');
    const contract = validateAlgorithmContract(v.contract),
        programs: Record<string, ShaderProgram> = {};
    for (const [name, program] of Object.entries(record(v.programs, 'programs')))
        Object.defineProperty(programs, identifier(name), { value: validateShaderProgram(program), enumerable: true });
    if (!Object.keys(programs).length) invalid('算法缺少 Shader。');
    return { id, version, hash: String(v.hash), apiVersion: 1, contract, source: text(v.source, '算法源码'), programs };
}
export function validateUniform(value: unknown, type: UniformType, length?: number): void {
    if (type === 'source') {
        if (value !== 'source') invalid('纹理只能引用当前效果输入。');
        return;
    }
    if (type === 'color') {
        if (typeof value !== 'string' || !/^#[a-f\d]{6}$/i.test(value)) invalid('uniform 颜色无效。');
        return;
    }
    if (type === 'boolean') {
        if (typeof value !== 'boolean') invalid('uniform 布尔值无效。');
        return;
    }
    if (type === 'number' || type === 'int') {
        finite(value, 'uniform');
        if (type === 'int') integer(value, 'uniform');
        return;
    }
    const count = type === 'vec2' ? 2 : type === 'vec3' ? 3 : length;
    if (!Array.isArray(value) || value.length !== count) invalid('uniform 向量长度无效。');
    for (const n of value as unknown[]) finite(n, 'uniform 分量');
}
