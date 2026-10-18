import type { KernelContract } from './kernelContracts';
export const primitiveKernelContracts = {
    solid: {
        kind: 'visual',
        parameters: [
            {
                id: 'color',
                valueKind: 'color',
                allowedSourceKinds: ['constant'],
            },
            {
                id: 'opacity',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 2,
                },
            },
        ],
    },
    'spectral-strings': {
        kind: 'visual',
        inputParameter: 'spectrum',
        parameters: [
            {
                id: 'spectrum',
                valueKind: 'vector',
                allowedSourceKinds: ['analysis', 'constant', 'native'],
                allowEmptyVector: true,
                vectorElementRange: {
                    min: 0,
                    max: 1.7976931348623157e308,
                },
                allowedAnalysisComponents: ['default', 'specific', 'magnitude'],
                allowedAnalysisProjections: ['full'],
            },
            {
                id: 'color',
                valueKind: 'color',
                allowedSourceKinds: ['constant'],
            },
            {
                id: 'opacity',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'count',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 4,
                    max: 64,
                    integer: true,
                    editingPrecision: 0,
                },
            },
            {
                id: 'thickness',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0.3,
                    max: 8,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'amplitude',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 0.2,
                    integer: false,
                    editingPrecision: 5,
                },
            },
            {
                id: 'decay',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0.05,
                    max: 5,
                    integer: false,
                    editingPrecision: 3,
                },
            },
            {
                id: 'sensitivity',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 8,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'x',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 3,
                },
            },
            {
                id: 'y',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 3,
                },
            },
            {
                id: 'width',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0.05,
                    max: 1,
                    integer: false,
                    editingPrecision: 3,
                },
            },
            {
                id: 'height',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0.05,
                    max: 1,
                    integer: false,
                    editingPrecision: 3,
                },
            },
        ],
    },
    'spectral-dots': {
        kind: 'visual',
        inputParameter: 'spectrum',
        parameters: [
            {
                id: 'spectrum',
                valueKind: 'vector',
                allowedSourceKinds: ['analysis', 'constant', 'native'],
                allowEmptyVector: true,
                vectorElementRange: {
                    min: 0,
                    max: 1.7976931348623157e308,
                },
                allowedAnalysisComponents: ['default', 'specific', 'magnitude'],
                allowedAnalysisProjections: ['full'],
            },
            {
                id: 'color',
                valueKind: 'color',
                allowedSourceKinds: ['constant'],
            },
            {
                id: 'opacity',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'count',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 4,
                    max: 64,
                    integer: true,
                    editingPrecision: 0,
                },
            },
            {
                id: 'rows',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 1,
                    max: 9,
                    integer: true,
                    editingPrecision: 0,
                },
            },
            {
                id: 'size',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0.5,
                    max: 20,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'spacing',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 2,
                    max: 40,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'amplitude',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 0.4,
                    integer: false,
                    editingPrecision: 5,
                },
            },
            {
                id: 'sensitivity',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 8,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'x',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 3,
                },
            },
            {
                id: 'y',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 3,
                },
            },
            {
                id: 'width',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0.05,
                    max: 1,
                    integer: false,
                    editingPrecision: 3,
                },
            },
        ],
    },
    'reactive-rings': {
        kind: 'visual',
        inputParameter: 'amount',
        parameters: [
            {
                id: 'amount',
                valueKind: 'number',
                allowedSourceKinds: ['constant', 'analysis'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 2,
                },
                allowedAnalysisComponents: ['default', 'total', 'specific', 'real', 'imag', 'magnitude', 'phase'],
                allowedAnalysisProjections: ['scalar', 'mean', 'max', 'peak', 'bin', 'band'],
            },
            {
                id: 'color',
                valueKind: 'color',
                allowedSourceKinds: ['constant'],
            },
            {
                id: 'opacity',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'count',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 1,
                    max: 8,
                    integer: true,
                    editingPrecision: 0,
                },
            },
            {
                id: 'radius',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0.005,
                    max: 0.5,
                    integer: false,
                    editingPrecision: 4,
                },
            },
            {
                id: 'thickness',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0.3,
                    max: 10,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'amplitude',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 0.4,
                    integer: false,
                    editingPrecision: 5,
                },
            },
            {
                id: 'x',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 3,
                },
            },
            {
                id: 'y',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 3,
                },
            },
        ],
    },
    scale: {
        kind: 'modifier',
        inputParameter: 'amount',
        parameters: [
            {
                id: 'amount',
                valueKind: 'number',
                allowedSourceKinds: ['constant', 'analysis'],
                range: {
                    min: 0.05,
                    max: 8,
                    integer: false,
                    editingPrecision: 2,
                },
                allowedAnalysisComponents: ['default', 'total', 'specific', 'real', 'imag', 'magnitude', 'phase'],
                allowedAnalysisProjections: ['scalar', 'mean', 'max', 'peak', 'bin', 'band'],
            },
        ],
    },
    blur: {
        kind: 'modifier',
        inputParameter: 'amount',
        parameters: [
            {
                id: 'amount',
                valueKind: 'number',
                allowedSourceKinds: ['constant', 'analysis'],
                range: {
                    min: 0,
                    max: 48,
                    integer: false,
                    editingPrecision: 2,
                },
                allowedAnalysisComponents: ['default', 'total', 'specific', 'real', 'imag', 'magnitude', 'phase'],
                allowedAnalysisProjections: ['scalar', 'mean', 'max', 'peak', 'bin', 'band'],
            },
        ],
    },
    fade: {
        kind: 'transition',
        parameters: [
            {
                id: 'from',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'to',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 1,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'smooth',
                valueKind: 'boolean',
                allowedSourceKinds: ['constant'],
            },
        ],
    },
} satisfies Record<string, KernelContract>;
