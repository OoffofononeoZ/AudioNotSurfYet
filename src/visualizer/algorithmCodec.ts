import { validateLyricInputs } from './lyricCodec';
import { validateMediaInputs } from './mediaCodec';
import { finite, integer, invalid, keys, record, text } from './projectValidation';
import { resourceHash } from './resourceIdentity';
import { validateMarkerInputs } from './editorMarkerValidation';
import type {
    AlgorithmContract,
    AlgorithmDefinition,
    AlgorithmParameter,
    ShaderProgram,
    UniformType,
} from './algorithmTypes';

const identifier = (value: unknown) => {
    const id = text(value, '算法标识');
    if (!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(id) || ['__proto__', 'prototype', 'constructor'].includes(id))
        invalid('算法标识无效。');
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
export function validateAlgorithmContract(input: unknown, apiVersion: 1 | 2 | 3 | 4 | 5 = 1): AlgorithmContract {
    const v = record(input, '算法契约');
    keys(
        v,
        ['kind', 'parameters', 'sharedParameters', 'historyParameters'],
        apiVersion >= 3
            ? [
                  'inputParameter',
                  'markerInputs',
                  'timingInput',
                  'mediaInputs',
                  'executionModes',
                  'stateParameters',
                  ...(apiVersion === 4 ? ['renderSpace'] : []),
                  ...(apiVersion === 5 ? ['lyricInputs'] : []),
              ]
            : apiVersion === 2
              ? ['inputParameter', 'markerInputs', 'timingInput', 'stateParameters']
              : ['inputParameter', 'stateParameters'],
    );
    if (!['visual', 'modifier', 'transition'].includes(String(v.kind)) || !Array.isArray(v.parameters))
        return invalid('算法种类或参数无效。');
    if (apiVersion === 4 && (v.renderSpace !== 'world' || v.kind !== 'visual')) invalid('三维场景配置无效。');
    const parameters = v.parameters.map(parameter),
        ids = parameters.map(p => p.id);
    if (new Set(ids).size !== ids.length) invalid('算法参数重复。');
    if (v.inputParameter !== undefined && !ids.includes(identifier(v.inputParameter))) invalid('算法输入参数不存在。');
    const sharedParameters = list(v.sharedParameters, ids),
        historyParameters = list(v.historyParameters, ids);
    const stateParameters = v.stateParameters === undefined ? undefined : list(v.stateParameters, ids);
    if (sharedParameters.some(id => parameters.find(p => p.id === id)?.valueKind !== 'number'))
        invalid('共同处理参数必须为数值。');
    const markerInputs =
        apiVersion === 2 || (apiVersion >= 3 && v.markerInputs !== undefined)
            ? validateMarkerInputs(v.markerInputs)
            : undefined;
    const mediaInputs = apiVersion >= 3 ? validateMediaInputs(v.mediaInputs) : undefined;
    const executionModes =
        apiVersion >= 3 ? (list(v.executionModes, ['timeline', 'realtime']) as ('timeline' | 'realtime')[]) : undefined;
    if (executionModes && !executionModes.length) invalid('ABI 3 必须声明执行模式。');
    const lyricInputs = apiVersion === 5 ? validateLyricInputs(v.lyricInputs) : undefined;
    if (
        apiVersion === 5 &&
        (!lyricInputs || v.kind !== 'visual' || executionModes?.length !== 1 || executionModes[0] !== 'timeline')
    )
        invalid('ABI 5 歌词元素必须声明歌词输入并仅支持歌曲模式。');
    let timingInput: string | undefined;
    if (v.timingInput !== undefined) {
        timingInput = identifier(v.timingInput);
        const marker = markerInputs?.find(i => i.id === timingInput);
        if (
            v.kind !== 'transition' ||
            !marker ||
            marker.eventKind !== 'range' ||
            marker.selectionModes.length !== 1 ||
            marker.selectionModes[0] !== 'single'
        )
            invalid('转场时间输入必须声明单个范围。');
    }
    return {
        kind: v.kind as AlgorithmContract['kind'],
        ...(apiVersion === 4 ? { renderSpace: 'world' as const } : {}),
        parameters,
        sharedParameters,
        historyParameters,
        ...(stateParameters ? { stateParameters } : {}),
        ...(v.inputParameter !== undefined ? { inputParameter: String(v.inputParameter) } : {}),
        ...(markerInputs ? { markerInputs } : {}),
        ...(timingInput ? { timingInput } : {}),
        ...(mediaInputs ? { mediaInputs } : {}),
        ...(lyricInputs ? { lyricInputs } : {}),
        ...(executionModes ? { executionModes } : {}),
    };
}
export function validateShaderProgram(input: unknown): ShaderProgram {
    const v = record(input, 'Shader');
    keys(v, ['vertex', 'fragment', 'geometry', 'uniforms'], ['alphaMode', 'alphaCutoff']);
    if (v.alphaMode !== undefined && !['opaque', 'mask'].includes(String(v.alphaMode))) invalid('三维场景配置无效。');
    if (
        v.alphaCutoff !== undefined &&
        (v.alphaMode !== 'mask' || finite(v.alphaCutoff, 'alphaCutoff') < 0 || Number(v.alphaCutoff) > 1)
    )
        invalid('三维场景配置无效。');
    text(v.vertex, 'vertex');
    text(v.fragment, 'fragment');
    if (!['quad', 'triangles'].includes(String(v.geometry))) invalid('Shader 几何类型无效。');
    const uniforms = record(v.uniforms, 'uniforms');
    for (const [name, raw] of Object.entries(uniforms)) {
        identifier(name);
        const u = record(raw, 'uniform');
        keys(u, ['type'], ['length', 'inputId', 'slot']);
        if (
            !['number', 'int', 'boolean', 'color', 'vec2', 'vec3', 'array', 'source', 'media', 'lyrics'].includes(
                String(u.type),
            )
        )
            invalid('uniform 类型无效。');
        if (u.type === 'media') {
            identifier(u.inputId);
            if (!['current', 'next'].includes(String(u.slot))) invalid('媒体纹理 slot 无效。');
        } else if (u.type === 'lyrics') {
            identifier(u.inputId);
            if (u.slot !== undefined) invalid('歌词纹理不使用媒体 slot。');
        } else if (u.inputId !== undefined || u.slot !== undefined) invalid('仅媒体纹理声明媒体输入。');
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
    if (![1, 2, 3, 4, 5].includes(Number(v.apiVersion)) || typeof v.apiVersion !== 'number')
        invalid('算法 ABI 不受支持。');
    if (typeof v.hash !== 'string' || !/^[a-f0-9]{64}$/.test(v.hash) || resourceHash(v) !== v.hash)
        invalid('算法内容与 SHA-256 不匹配。');
    const contract = validateAlgorithmContract(v.contract, v.apiVersion as 1 | 2 | 3 | 4 | 5),
        programs: Record<string, ShaderProgram> = {};
    for (const [name, program] of Object.entries(record(v.programs, 'programs')))
        Object.defineProperty(programs, identifier(name), { value: validateShaderProgram(program), enumerable: true });
    for (const program of Object.values(programs))
        for (const u of Object.values(program.uniforms))
            if (
                u.type === 'media' &&
                (Number(v.apiVersion) < 3 || !contract.mediaInputs?.some(i => i.id === u.inputId))
            )
                invalid('媒体纹理未获声明授权。');
    for (const program of Object.values(programs))
        for (const u of Object.values(program.uniforms))
            if (u.type === 'lyrics' && (v.apiVersion !== 5 || !contract.lyricInputs?.some(i => i.id === u.inputId)))
                invalid('歌词纹理未获声明授权。');
    for (const p of Object.values(programs)) {
        if (v.apiVersion === 5 && p.geometry !== 'triangles') invalid('歌词绘制必须使用三角形。');
        if (v.apiVersion === 4 && (p.geometry !== 'triangles' || !p.alphaMode)) invalid('三维场景配置无效。');
        if (v.apiVersion === 4 && Object.values(p.uniforms).some(u => u.type === 'source'))
            invalid('世界空间元素不能读取二维效果输入。');
        if (v.apiVersion !== 4 && (p.alphaMode !== undefined || p.alphaCutoff !== undefined))
            invalid('三维场景配置无效。');
    }
    if (!Object.keys(programs).length) invalid('算法缺少 Shader。');
    return {
        id,
        version,
        hash: String(v.hash),
        apiVersion: v.apiVersion as 1 | 2 | 3 | 4 | 5,
        contract,
        source: text(v.source, '算法源码'),
        programs,
    };
}
export function validateUniform(value: unknown, type: UniformType, length?: number): void {
    if (type === 'lyrics') {
        const page = integer(value, '歌词图集页');
        if (page < 0 || page >= 4) invalid('歌词图集页无效。');
        return;
    }
    if (type === 'media') {
        identifier(value);
        return;
    }
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
