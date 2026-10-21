import { describe, expect, it } from 'vitest';
import {
    createComposition,
    encodeComposition,
    decodeComposition,
    validateComposition,
} from '../../src/visualizer/compositionCodec';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { planCompositionInputs } from '../../src/visualizer/compositionModel';
import { CompositionResolver } from '../../src/visualizer/compositionResolver';
import { inspectRealtimeProject } from '../../src/visualizer/realtimeCapabilities';
import { attachElements } from './resource-fixtures';
import type { AnalysisSeries } from '../../src/analysis/types';

function project() {
    const p = createComposition({
        contentHash: 'a'.repeat(64),
        fileName: 'stems.wav',
        durationSeconds: 2,
        sampleRate: 44100,
    });
    p.elements = ['drums', 'vocals', undefined].map((role, i) => {
        const element = elementRegistry.create('spectral-dots', 2, i);
        element.bindings[0] = {
            parameterId: 'spectrum',
            source: {
                kind: 'analysis',
                featureId: 'wallpaperEngineSpectrum',
                projection: { kind: 'full' },
                ...(role ? { stemRole: role as 'drums' } : {}),
            },
        };
        return element;
    });
    return attachElements(p);
}
describe('Visualizer source-aware inputs', () => {
    it('persists, deduplicates and isolates same-name features across sources', () => {
        const p = project();
        expect(planCompositionInputs(p)).toEqual([
            { featureId: 'wallpaperEngineSpectrum' },
            { featureId: 'wallpaperEngineSpectrum', stemRole: 'drums' },
            { featureId: 'wallpaperEngineSpectrum', stemRole: 'vocals' },
        ]);
        expect(decodeComposition(encodeComposition(p).buffer as ArrayBuffer)).toEqual(p);
        const values = new CompositionResolver().resolve(p, 0, (featureId, role): AnalysisSeries => ({
            schemaVersion: 1,
            trackHash: p.track.contentHash,
            configHash: role ?? 'original',
            featureId,
            startTimeSeconds: 0,
            sampleStepSeconds: 1 / 30,
            sampleCount: 1,
            dimensions: [128],
            payload: {
                kind: 'stereo-spectrum-f32',
                width: 128,
                values: new Float32Array(128).fill(role === 'drums' ? 1 : role === 'vocals' ? 2 : 3),
            },
        }));
        expect(values.get(p.elements[0]!.id)?.get('spectrum')?.value).toEqual(Array(128).fill(1));
        expect(values.get(p.elements[1]!.id)?.get('spectrum')?.value).toEqual(Array(128).fill(2));
        expect(values.get(p.elements[2]!.id)?.get('spectrum')?.value).toEqual(Array(128).fill(3));
        expect(inspectRealtimeProject(p).browser).toBe(false);
    });
    it('rejects unsupported stem features without changing original feature contracts', () => {
        const p = project();
        const binding = p.elements[0]!.bindings[0]!;
        if (binding.source.kind !== 'analysis') throw Error('fixture');
        binding.source.featureId = 'mfcc';
        expect(() => validateComposition(p)).toThrow();
        delete binding.source.stemRole;
        expect(() => validateComposition(p)).not.toThrow();
    });
});
