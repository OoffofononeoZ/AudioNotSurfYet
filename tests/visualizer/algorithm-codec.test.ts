import { describe, expect, test } from 'vitest';
import { validateAlgorithmDefinition, validateAlgorithmContract } from '../../src/visualizer/algorithmCodec';
import { resourceHash } from '../../src/visualizer/resourceIdentity';
const algorithm = () => {
    const v = {
        id: 'unregistered-example',
        version: 1,
        apiVersion: 1,
        contract: { kind: 'visual', parameters: [], sharedParameters: [], historyParameters: [] },
        source: 'export function create() { return { prepareFrame() { return { passes: [] }; } }; }',
        programs: { draw: { vertex: 'void main(){}', fragment: 'void main(){}', geometry: 'quad', uniforms: {} } },
    };
    return { ...v, hash: resourceHash(v) };
};
describe('algorithm snapshot codec', () => {
    test('state dependencies are optional, may be empty, and reference unique declared parameters', () => {
        const contract = {
            kind: 'visual',
            parameters: [{ id: 'decay', valueKind: 'number', allowedSourceKinds: ['constant'] }],
            sharedParameters: [],
            historyParameters: [],
        };
        expect(validateAlgorithmContract(contract)).not.toHaveProperty('stateParameters');
        for (const api of [1, 2, 3] as const) {
            const base = {
                ...contract,
                ...(api === 2
                    ? { markerInputs: [{ id: 'points', eventKind: 'point', selectionModes: ['collection'] }] }
                    : {}),
                ...(api === 3 ? { executionModes: ['timeline'] } : {}),
            };
            for (const stateParameters of [[], ['decay']])
                expect(validateAlgorithmContract({ ...base, stateParameters }, api).stateParameters).toEqual(
                    stateParameters,
                );
            for (const stateParameters of [['missing'], ['decay', 'decay'], null])
                expect(() => validateAlgorithmContract({ ...base, stateParameters }, api)).toThrow();
        }
    });
    test('accepts a new algorithm identity without registering application code and never evaluates it', () => {
        const input = algorithm();
        input.source = 'throw new Error("must not execute during decoding")';
        input.hash = resourceHash(input);
        expect(validateAlgorithmDefinition(input)).toEqual(input);
    });
    test('binds source, shader and contract to the same content hash', () => {
        for (const change of [
            (v: ReturnType<typeof algorithm>) => (v.source += '\n// changed'),
            (v: ReturnType<typeof algorithm>) => (v.programs.draw.fragment += '\n// changed'),
            (v: ReturnType<typeof algorithm>) => (v.contract.kind = 'modifier'),
        ]) {
            const input = algorithm();
            change(input);
            expect(() => validateAlgorithmDefinition(input)).toThrow(/SHA-256/);
        }
    });
    test('rejects unknown ABI, capabilities, parameters and shader interfaces', () => {
        for (const patch of [
            { apiVersion: 99 },
            { contract: { kind: 'visual', parameters: [], sharedParameters: ['missing'], historyParameters: [] } },
            { programs: { draw: { vertex: 'x', fragment: 'x', geometry: 'canvas', uniforms: {} } } },
            { extra: true },
        ]) {
            const input = { ...algorithm(), ...patch };
            input.hash = resourceHash(input);
            expect(() => validateAlgorithmDefinition(input)).toThrow();
        }
    });
});
