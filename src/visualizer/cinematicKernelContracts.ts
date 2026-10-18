import type { KernelContract } from './kernelContracts';
export const cinematicKernelContracts = {
    'light-tunnel': {
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
                id: 'sensitivity',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 5,
                    integer: false,
                    editingPrecision: 2,
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
                id: 'accent',
                valueKind: 'color',
                allowedSourceKinds: ['constant'],
            },
            {
                id: 'count',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 4,
                    max: 48,
                    integer: true,
                    editingPrecision: 0,
                },
            },
            {
                id: 'sides',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 3,
                    max: 12,
                    integer: true,
                    editingPrecision: 0,
                },
            },
            {
                id: 'speed',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: -0.5,
                    max: 0.5,
                    integer: false,
                    editingPrecision: 3,
                },
            },
            {
                id: 'twist',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: -8,
                    max: 8,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'spread',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0.1,
                    max: 3,
                    integer: false,
                    editingPrecision: 2,
                },
            },
            {
                id: 'drift',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 0.2,
                    integer: false,
                    editingPrecision: 5,
                },
            },
        ],
    },
    starfield: {
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
                id: 'sensitivity',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0,
                    max: 5,
                    integer: false,
                    editingPrecision: 2,
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
                id: 'count',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 8,
                    max: 800,
                    integer: true,
                    editingPrecision: 0,
                },
            },
            {
                id: 'speed',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: -0.5,
                    max: 0.5,
                    integer: false,
                    editingPrecision: 3,
                },
            },
            {
                id: 'stretch',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0.001,
                    max: 0.15,
                    integer: false,
                    editingPrecision: 5,
                },
            },
            {
                id: 'spread',
                valueKind: 'number',
                allowedSourceKinds: ['constant'],
                range: {
                    min: 0.1,
                    max: 3,
                    integer: false,
                    editingPrecision: 2,
                },
            },
        ],
    },
} satisfies Record<string, KernelContract>;
