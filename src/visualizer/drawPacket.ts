import { finite, invalid, keys, record } from './projectValidation';
import { validateUniform } from './algorithmCodec';
import type { AlgorithmDefinition, DrawPacket, DrawPass, MeshPacket } from './algorithmTypes';

export function validateDrawPacket(input: unknown, algorithm: AlgorithmDefinition): DrawPacket {
    const v = record(input, '绘图数据');
    keys(v, ['passes'], ['state']);
    if (!Array.isArray(v.passes)) return invalid('绘图 pass 必须为列表。');
    const passes = v.passes.map(raw => {
        const p = record(raw, '绘图 pass');
        keys(p, ['program', 'uniforms'], ['mesh']);
        const program = Object.prototype.hasOwnProperty.call(algorithm.programs, String(p.program))
            ? algorithm.programs[String(p.program)]
            : undefined;
        if (!program) return invalid('绘图引用了未声明的 Shader。');
        const uniforms = record(p.uniforms, 'uniforms');
        keys(uniforms, Object.keys(program.uniforms));
        for (const [name, type] of Object.entries(program.uniforms))
            validateUniform(uniforms[name], type.type, type.length);
        if (program.geometry === 'triangles') {
            const mesh = record(p.mesh, 'mesh');
            keys(mesh, ['positions', 'colors', 'edges']);
            const count = (mesh.positions as Float32Array)?.length / 3;
            if (!Number.isInteger(count) || count < 0 || count > 65536 || count % 3)
                invalid('几何元素超过顶点容量或三角形数据无效。');
            for (const [name, size] of [
                ['positions', 3],
                ['colors', 4],
                ['edges', 2],
            ] as const) {
                const values = mesh[name];
                if (!(values instanceof Float32Array) || values.length !== count * size) invalid('几何缓冲长度无效。');
                for (const n of values as Float32Array) finite(n, '顶点');
            }
        } else if (p.mesh !== undefined) invalid('全屏 pass 不能提供几何缓冲。');
        return {
            program: String(p.program),
            uniforms,
            ...(p.mesh ? { mesh: p.mesh as unknown as MeshPacket } : {}),
        } as DrawPass;
    });
    if (v.state !== undefined) {
        if (!Array.isArray(v.state) || v.state.length > 65536) invalid('算法状态快照无效。');
        for (const value of v.state as unknown[]) finite(value, '算法状态');
    }
    return { passes, ...(v.state !== undefined ? { state: v.state as number[] } : {}) };
}
