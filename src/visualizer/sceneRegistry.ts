import type {
    VisualizerAnalysisComponent,
    VisualizerAnalysisProjectionV1,
    VisualizerParameterBindingV1,
    VisualizerTemplateId,
} from './types';
import { createCubeSwarmScene } from './cubeSwarmScene';
import { createOrthogonalLinesScene } from './orthogonalLinesScene';
import type { VisualizerSceneFactory } from './rendererTypes';

export type SceneParameterValueKind = 'number' | 'boolean' | 'color' | 'vector';
export type SceneBindingSourceKind = 'constant' | 'analysis' | 'editor-event';

export interface SceneNumericRange {
    readonly min: number;
    readonly max: number;
    readonly integer?: boolean;
}

export interface SceneParameterDescriptor {
    readonly id: string;
    readonly label: string;
    readonly valueKind: SceneParameterValueKind;
    readonly defaultValue: number | string | boolean | readonly number[];
    readonly allowedSourceKinds: readonly SceneBindingSourceKind[];
    readonly range?: SceneNumericRange;
    readonly vectorElementRange?: SceneNumericRange;
    readonly allowEmptyVector?: boolean;
    readonly allowedAnalysisComponents?: readonly VisualizerAnalysisComponent[];
    readonly allowedAnalysisProjections?: readonly VisualizerAnalysisProjectionV1['kind'][];
    readonly defaultBinding?: Omit<VisualizerParameterBindingV1, 'parameterId'>;
}

export interface SceneTemplateDescriptor {
    readonly id: VisualizerTemplateId;
    readonly version: 1;
    readonly title: string;
    readonly description: string;
    readonly parameters: readonly SceneParameterDescriptor[];
    readonly create?: VisualizerSceneFactory;
}

const NUMERIC_ANALYSIS_COMPONENTS: readonly VisualizerAnalysisComponent[] = [
    'default', 'total', 'specific', 'real', 'imag', 'magnitude', 'phase',
];

const NUMERIC_ANALYSIS_PROJECTIONS: readonly VisualizerAnalysisProjectionV1['kind'][] = [
    'scalar', 'mean', 'max', 'peak', 'bin', 'band',
];

const ORTHOGONAL_LINES: SceneTemplateDescriptor = {
    id: 'orthogonal-lines',
    version: 1,
    title: '正交线条',
    description: '横线和竖线由 Analyzer 特征或 Editor 事件实时驱动。',
    create: createOrthogonalLinesScene,
    parameters: [
        { id: 'horizontalEnabled', label: '横线启用', valueKind: 'boolean', defaultValue: true, allowedSourceKinds: ['constant'] },
        { id: 'horizontalIntensity', label: '横线强度', valueKind: 'number', defaultValue: 0, allowedSourceKinds: ['constant', 'analysis', 'editor-event'], range: { min: 0, max: 1 }, allowedAnalysisComponents: NUMERIC_ANALYSIS_COMPONENTS, allowedAnalysisProjections: NUMERIC_ANALYSIS_PROJECTIONS },
        { id: 'horizontalColor', label: '横线颜色', valueKind: 'color', defaultValue: '#64f6b5', allowedSourceKinds: ['constant'] },
        { id: 'horizontalThickness', label: '横线粗细', valueKind: 'number', defaultValue: 2, allowedSourceKinds: ['constant'], range: { min: 0.5, max: 64 } },
        { id: 'horizontalBrightness', label: '横线亮度', valueKind: 'number', defaultValue: 1, allowedSourceKinds: ['constant'], range: { min: 0, max: 4 } },
        { id: 'horizontalDecay', label: '横线衰减', valueKind: 'number', defaultValue: 0.25, allowedSourceKinds: ['constant'], range: { min: 0, max: 10 } },
        { id: 'verticalEnabled', label: '竖线启用', valueKind: 'boolean', defaultValue: true, allowedSourceKinds: ['constant'] },
        { id: 'verticalIntensity', label: '竖线强度', valueKind: 'number', defaultValue: 0, allowedSourceKinds: ['constant', 'analysis', 'editor-event'], range: { min: 0, max: 1 }, allowedAnalysisComponents: NUMERIC_ANALYSIS_COMPONENTS, allowedAnalysisProjections: NUMERIC_ANALYSIS_PROJECTIONS },
        { id: 'verticalColor', label: '竖线颜色', valueKind: 'color', defaultValue: '#f4f7f5', allowedSourceKinds: ['constant'] },
        { id: 'verticalThickness', label: '竖线粗细', valueKind: 'number', defaultValue: 2, allowedSourceKinds: ['constant'], range: { min: 0.5, max: 64 } },
        { id: 'verticalBrightness', label: '竖线亮度', valueKind: 'number', defaultValue: 1, allowedSourceKinds: ['constant'], range: { min: 0, max: 4 } },
        { id: 'verticalDecay', label: '竖线衰减', valueKind: 'number', defaultValue: 0.18, allowedSourceKinds: ['constant'], range: { min: 0, max: 10 } },
    ],
};

const CUBE_SWARM: SceneTemplateDescriptor = {
    id: 'cube-swarm',
    version: 1,
    title: '立方体群',
    description: '频谱核心环、Energy 上升方块和三颗分层轨道卫星。',
    create: createCubeSwarmScene,
    parameters: [
        { id: 'centerSpectrum', label: '中心频谱', valueKind: 'vector', defaultValue: [], allowedSourceKinds: ['constant', 'analysis'], vectorElementRange: { min: 0, max: Number.MAX_VALUE }, allowEmptyVector: true, allowedAnalysisComponents: ['default', 'specific', 'magnitude'], allowedAnalysisProjections: ['full'], defaultBinding: { source: { kind: 'analysis', featureId: 'amplitudeSpectrum', projection: { kind: 'full' } } } },
        { id: 'coreScale', label: '核心缩放', valueKind: 'number', defaultValue: 1, allowedSourceKinds: ['constant', 'analysis', 'editor-event'], range: { min: 0, max: 8 }, allowedAnalysisComponents: NUMERIC_ANALYSIS_COMPONENTS, allowedAnalysisProjections: NUMERIC_ANALYSIS_PROJECTIONS },
        { id: 'riseSpeed', label: '上升速度', valueKind: 'number', defaultValue: 0.25, allowedSourceKinds: ['constant', 'analysis', 'editor-event'], range: { min: 0, max: 20 }, allowedAnalysisComponents: NUMERIC_ANALYSIS_COMPONENTS, allowedAnalysisProjections: NUMERIC_ANALYSIS_PROJECTIONS, defaultBinding: { source: { kind: 'analysis', featureId: 'energy', projection: { kind: 'scalar' } }, transform: { inputMin: 0, inputMax: 25, outputMin: 0.25, outputMax: 3, clamp: true, invert: false, attackSeconds: 0, releaseSeconds: 0 } } },
        { id: 'orbitSpeed', label: '卫星旋转速度', valueKind: 'number', defaultValue: 0.3, allowedSourceKinds: ['constant', 'analysis', 'editor-event'], range: { min: -12, max: 12 }, allowedAnalysisComponents: NUMERIC_ANALYSIS_COMPONENTS, allowedAnalysisProjections: NUMERIC_ANALYSIS_PROJECTIONS },
        { id: 'cubeCount', label: '立方体数量', valueKind: 'number', defaultValue: 48, allowedSourceKinds: ['constant'], range: { min: 1, max: 512, integer: true } },
        { id: 'coreColor', label: '核心颜色', valueKind: 'color', defaultValue: '#f3ebef', allowedSourceKinds: ['constant'] },
        { id: 'peripheralColor', label: '外围颜色', valueKind: 'color', defaultValue: '#d8c7d1', allowedSourceKinds: ['constant'] },
        { id: 'baseSize', label: '基础尺寸', valueKind: 'number', defaultValue: 1, allowedSourceKinds: ['constant'], range: { min: 0.01, max: 10 } },
        { id: 'cameraDistance', label: '相机距离', valueKind: 'number', defaultValue: 8, allowedSourceKinds: ['constant'], range: { min: 1, max: 100 } },
        { id: 'backgroundColor', label: '背景颜色', valueKind: 'color', defaultValue: '#020403', allowedSourceKinds: ['constant'] },
    ],
};

export class SceneRegistry {
    private readonly descriptors = new Map<VisualizerTemplateId, SceneTemplateDescriptor>();

    constructor(descriptors: readonly SceneTemplateDescriptor[] = [
        ORTHOGONAL_LINES,
        CUBE_SWARM,
    ]) {
        for (const descriptor of descriptors) {
            if (this.descriptors.has(descriptor.id)) {
                throw new Error(`Duplicate Visualizer template: ${descriptor.id}`);
            }
            const ids = new Set<string>();
            for (const parameter of descriptor.parameters) {
                if (ids.has(parameter.id)) {
                    throw new Error(`Duplicate Visualizer parameter: ${parameter.id}`);
                }
                ids.add(parameter.id);
            }
            this.descriptors.set(descriptor.id, descriptor);
        }
    }

    list(): readonly SceneTemplateDescriptor[] {
        return [...this.descriptors.values()];
    }

    get(id: VisualizerTemplateId, version = 1): SceneTemplateDescriptor {
        const descriptor = this.descriptors.get(id);
        if (!descriptor || descriptor.version !== version) {
            throw new Error(`Unknown Visualizer template: ${id}@${version}`);
        }
        return descriptor;
    }

    createConstantBindings(id: VisualizerTemplateId): VisualizerParameterBindingV1[] {
        return this.get(id).parameters.map((parameter) => {
            const value: number | string | boolean | number[] =
                typeof parameter.defaultValue === 'object'
                    ? [...parameter.defaultValue]
                    : parameter.defaultValue;
            return {
                parameterId: parameter.id,
                source: { kind: 'constant', value },
            };
        });
    }

    createDefaultBindings(id: VisualizerTemplateId): VisualizerParameterBindingV1[] {
        return this.get(id).parameters.map((parameter) => {
            if (parameter.defaultBinding) {
                return {
                    parameterId: parameter.id,
                    source: structuredClone(parameter.defaultBinding.source),
                    ...(parameter.defaultBinding.transform
                        ? { transform: { ...parameter.defaultBinding.transform } }
                        : {}),
                };
            }
            const value: number | string | boolean | number[] =
                typeof parameter.defaultValue === 'object'
                    ? [...parameter.defaultValue]
                    : parameter.defaultValue;
            return {
                parameterId: parameter.id,
                source: { kind: 'constant', value },
            };
        });
    }
}
