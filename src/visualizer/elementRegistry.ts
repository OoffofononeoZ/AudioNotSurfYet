import type { SceneParameterDescriptor } from './parameterDescriptor';
import type { ElementBinding, ElementKind, ElementType, VisualizerElement } from './compositionTypes';

export interface ElementDescriptor {
    id: ElementType;
    kind: ElementKind;
    title: string;
    icon: string;
    inputParameter?: string;
    parameters: readonly SceneParameterDescriptor[];
}
const number = (id: string, label: string, defaultValue: number, min: number, max: number, integer = false): SceneParameterDescriptor =>
    ({ id, label, defaultValue, valueKind: 'number', allowedSourceKinds: ['constant'], range: { min, max, integer } });
const color = (id: string, label: string, defaultValue = '#edf5f1'): SceneParameterDescriptor =>
    ({ id, label, defaultValue, valueKind: 'color', allowedSourceKinds: ['constant'] });
const dynamic = (p: SceneParameterDescriptor): SceneParameterDescriptor => ({ ...p,
    allowedSourceKinds: ['constant', 'analysis'],
    allowedAnalysisComponents: ['default', 'total', 'specific', 'real', 'imag', 'magnitude', 'phase'],
    allowedAnalysisProjections: ['scalar', 'mean', 'max', 'peak', 'bin', 'band'],
});
const signal: SceneParameterDescriptor = {
    id: 'spectrum', label: '频谱输入', valueKind: 'vector', defaultValue: [],
    allowedSourceKinds: ['analysis', 'constant'], allowEmptyVector: true,
    vectorElementRange: { min: 0, max: Number.MAX_VALUE },
    allowedAnalysisComponents: ['default', 'specific', 'magnitude'], allowedAnalysisProjections: ['full'],
    defaultBinding: { source: { kind: 'analysis', featureId: 'amplitudeSpectrum', projection: { kind: 'full' } } },
};
const opacity = number('opacity', '透明度', 1, 0, 1);
const position = [number('x', '水平位置', .5, 0, 1), number('y', '垂直位置', .5, 0, 1)];
const geometric = [signal, color('color', '线条颜色', '#ffffff'), opacity, ...position,
    number('sensitivity', '响应系数', .6, 0, 5), number('thickness', '线宽', 1, .3, 8)];
const chromatic: SceneParameterDescriptor = { id: 'chromatic', label: '强音彩色', valueKind: 'boolean', defaultValue: true, allowedSourceKinds: ['constant'] };
const energy = (id: string, label: string, defaultValue: number, min: number, max: number, outMin: number, outMax: number): SceneParameterDescriptor => ({
    ...dynamic(number(id, label, defaultValue, min, max)),
    defaultBinding: { source: { kind: 'analysis', featureId: 'energy', projection: { kind: 'scalar' } },
        transform: { inputMin: 0, inputMax: 25, outputMin: outMin, outputMax: outMax,
            clamp: true, invert: false, attackSeconds: .04, releaseSeconds: .2 } },
});

const ELEMENTS: readonly ElementDescriptor[] = [
    { id: 'solid', kind: 'visual', title: '纯色背景', icon: 'square', parameters: [color('color', '颜色', '#020403'), opacity] },
    { id: 'spectral-strings', kind: 'visual', title: '频谱弦线', icon: 'strings', inputParameter: 'spectrum', parameters: [signal, color('color', '颜色'), opacity,
        number('count', '弦线数量', 48, 4, 64, true), number('thickness', '粗细', 1, .3, 8),
        number('amplitude', '响应幅度', .035, 0, .2), number('decay', '衰减（秒）', .6, .05, 5),
        number('sensitivity', '灵敏度', 1, 0, 8), ...position, number('width', '宽度', .92, .05, 1), number('height', '高度', .9, .05, 1)] },
    { id: 'spectral-dots', kind: 'visual', title: '频谱点阵', icon: 'dots', inputParameter: 'spectrum', parameters: [signal, color('color', '颜色'), opacity,
        number('count', '每行点数', 64, 4, 64, true), number('rows', '行数', 5, 1, 9, true),
        number('size', '点尺寸', 3, .5, 20), number('spacing', '行间距', 10, 2, 40), number('amplitude', '响应幅度', .13, 0, .4),
        number('sensitivity', '灵敏度', 1, 0, 8), ...position, number('width', '宽度', .85, .05, 1)] },
    { id: 'reactive-rings', kind: 'visual', title: '响应圆环', icon: 'rings', inputParameter: 'amount', parameters: [energy('amount', '响应强度', 0, 0, 1, 0, 1), color('color', '颜色'), opacity,
        number('count', '圆环数量', 3, 1, 8, true), number('radius', '基础半径', .12, .005, .5), number('thickness', '粗细', 1.5, .3, 10),
        number('amplitude', '响应幅度', .12, 0, .4), ...position] },
    { id: 'radial-spectrum', kind: 'visual', title: '环形频谱', icon: 'radial', inputParameter: 'spectrum', parameters: [...geometric, chromatic,
        number('radius', '基础半径', .25, .01, .6), number('repeat', '频谱重复次数', 2, 1, 8, true),
        number('expansion', '整体扩张', 1, 0, 4), number('amplitude', '齿峰幅度', 1, 0, 8)] },
    { id: 'orbit-solids', kind: 'visual', title: '轨道几何体', icon: 'orbit', inputParameter: 'spectrum', parameters: [...geometric, chromatic,
        number('shape', '形状（0 方块 / 1 棱锥）', 0, 0, 1, true), number('count', '几何体数量', 12, 1, 32, true),
        number('radius', '轨道半径', .0875, 0, .5), number('size', '几何体尺寸', .00875, .001, .15),
        number('speed', '自转速度', .6, -4, 4), number('orbitSpeed', '公转速度', 0, -4, 4), number('wobble', '轨道游移', 0, 0, .2),
        number('threshold', '填色阈值', .05, 0, 1)] },
    { id: 'wireform', kind: 'visual', title: '旋转线框', icon: 'wireform', inputParameter: 'spectrum', parameters: [...geometric, chromatic,
        number('shape', '形状（0 方块 / 1 棱锥 / 2 圆环）', 0, 0, 2, true), number('size', '基础尺寸', .00875, .001, .4),
        number('amplitude', '尺寸响应', 7.5, 0, 12), number('speed', '旋转速度', -.6, -4, 4),
        number('phase', '旋转相位', 0, -6.284, 6.284), number('threshold', '填色阈值', .1286, 0, 1)] },
    { id: 'arc-lattice', kind: 'visual', title: '旋转弧簇', icon: 'arcs', inputParameter: 'spectrum', parameters: [...geometric,
        number('count', '圆弧数量', 19, 1, 32, true), number('radius', '起始半径', .0625, .005, .5),
        number('spacing', '半径间距', .0025, 0, .04), number('sweep', '圆弧角度', 50, 1, 360),
        number('amplitude', '扩张幅度', .0046875, 0, .1), number('speed', '旋转速度', 0, -4, 4)] },
    { id: 'light-tunnel', kind: 'visual', title: '光轨隧道', icon: 'tunnel', inputParameter: 'spectrum', parameters: [...geometric,
        color('accent', '交错颜色', '#ff408e'), number('count', '纵深层数', 28, 4, 48, true), number('sides', '截面边数', 6, 3, 12, true),
        number('speed', '穿行速度', .065, -.5, .5), number('twist', '纵深扭转', 2.4, -8, 8),
        number('spread', '隧道张幅', 1, .1, 3), number('drift', '视点游移', .035, 0, .2)] },
    { id: 'starfield', kind: 'visual', title: '跃迁星尘', icon: 'stars', inputParameter: 'spectrum', parameters: [...geometric,
        number('count', '星尘数量', 180, 8, 800, true), number('speed', '飞行速度', .08, -.5, .5),
        number('stretch', '光轨长度', .025, .001, .15), number('spread', '星尘张幅', 1, .1, 3)] },
    { id: 'scale', kind: 'modifier', title: '缩放', icon: 'scale', inputParameter: 'amount', parameters: [energy('amount', '缩放比例', 1, .05, 8, 1, 1.15)] },
    { id: 'blur', kind: 'modifier', title: '模糊', icon: 'blur', inputParameter: 'amount', parameters: [dynamic(number('amount', '模糊半径', 0, 0, 48))] },
    { id: 'fade', kind: 'transition', title: '淡入淡出', icon: 'fade', parameters: [number('from', '起始透明度', 0, 0, 1), number('to', '终止透明度', 1, 0, 1),
        { id: 'smooth', label: '平滑过渡', valueKind: 'boolean', defaultValue: true, allowedSourceKinds: ['constant'] }] },
];
export class ElementRegistry {
    list() { return ELEMENTS; }
    get(id: string): ElementDescriptor {
        const descriptor = ELEMENTS.find(entry => entry.id === id);
        if (!descriptor) throw new Error('未知可视化元素：' + id);
        return descriptor;
    }
    create(type: ElementType, durationSeconds: number, layer: number): VisualizerElement {
        const d = this.get(type);
        return { id: crypto.randomUUID(), type, version: 1, name: d.title, enabled: true, layer,
            timing: d.kind === 'transition' ? { kind: 'unbound' } : { kind: 'manual', startSeconds: 0, endSeconds: durationSeconds },
            bindings: d.parameters.map(p => ({ parameterId: p.id,
                ...(p.defaultBinding ? structuredClone(p.defaultBinding) : { source: { kind: 'constant', value: structuredClone(p.defaultValue) } }),
            })) as ElementBinding[],
            ...(d.kind === 'visual' ? {} : { targets: { kind: 'composition' as const } }),
        };
    }
}
export const elementRegistry = new ElementRegistry();
