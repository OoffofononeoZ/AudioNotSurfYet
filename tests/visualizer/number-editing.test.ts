import { attachElements } from './resource-fixtures';
import { expect, test } from 'vitest';
import { numberEditingStep, roundEditingValue, stepEditedNumber } from '../../src/utils/numberEditing';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { createPresetElements } from '../../src/visualizer/compositionPresets';
import { createComposition, decodeComposition, encodeComposition } from '../../src/visualizer/compositionCodec';

test('field precision fixes the step independently of entered digits', () => {
    expect([0, 2, 3, 4, 5].map(numberEditingStep)).toEqual([1, 0.1, 0.01, 0.001, 0.0001]);
    for (const [value, expected] of [
        [0.5, 0.6],
        [0.37, 0.47],
        [0.371, 0.47],
        [-0.37, -0.27],
    ]) {
        expect(stepEditedNumber(value!, 0, 1, { precision: 2 })).toBe(expected);
    }
    expect(stepEditedNumber(7, 0, -1, { precision: 0 })).toBe(6);
    expect(stepEditedNumber(0.00875, 0, 1, { precision: 5 })).toBe(0.00885);
    expect(stepEditedNumber(NaN, 0.5, 1, { precision: 2 })).toBe(0.6);
});

test('repeated stepping stays finite and obeys bounds and relational validity', () => {
    let value = -5;
    for (let i = 0; i < 100; i++) value = stepEditedNumber(value, 0, 1, { precision: 2 });
    expect(value).toBe(5);
    expect(stepEditedNumber(0.999, 0, 1, { precision: 2, min: 0, max: 1 })).toBe(1);
    expect(stepEditedNumber(0, 0, -1, { precision: 2, min: 0, max: 1 })).toBe(0);
    expect(stepEditedNumber(1.234567, 0, 1, { precision: 3, max: 1.234567 })).toBe(1.234567);
    expect(stepEditedNumber(0.99, 0, 1, { precision: 3, isValid: v => v < 1 })).toBe(0.99);
    expect(stepEditedNumber(1, 0, -1, { precision: 3, isValid: v => v > 0.99 })).toBe(1);
});

test('new visual defaults use semantic precision while loaded projects keep original values', () => {
    for (const descriptor of elementRegistry.list())
        for (const p of descriptor.parameters) {
            if (p.valueKind !== 'number') continue;
            expect(p.range?.editingPrecision).toBeDefined();
            expect(p.defaultValue).toBe(roundEditingValue(Number(p.defaultValue), p.range!.editingPrecision!));
        }
    const elements = createPresetElements('geometric-0.6', 123.456789);
    const template = elementRegistry.presets.find(p => p.id === 'geometric-0.6')!;
    const element = (key: string) => elements[template.elements.findIndex(e => e.key === key)]!;
    const constant = (key: string, id: string) => element(key).bindings.find(b => b.parameterId === id)!.source;
    expect(constant('element-9', 'size')).toEqual({ kind: 'constant', value: 0.03781 });
    expect(constant('element-8', 'amplitude')).toEqual({ kind: 'constant', value: 3.7 });
    expect(constant('element-4', 'amplitude')).toEqual({ kind: 'constant', value: 0.00469 });
    const project = createComposition({
        contentHash: 'a'.repeat(64),
        fileName: 'precision.wav',
        durationSeconds: 123.456789,
        sampleRate: 48000,
    });
    project.elements = elements;
    attachElements(project);
    element('element-9').bindings.find(b => b.parameterId === 'size')!.source = {
        kind: 'constant',
        value: 0.0378125,
    };
    expect(decodeComposition(encodeComposition(project).buffer as ArrayBuffer)).toEqual(project);
    expect(elements[0]!.timing).toMatchObject({ endSeconds: 123.456789 });
});
