import { describe, expect, it } from 'vitest';
import { expandQuantizedConstants } from '../../src/transcription/onnxConstants';

// Tiny ONNX protobuf fixtures: tests specify graph semantics and expected constants.
const join = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap(part => Array.from(part)));
const v = (n: number): Uint8Array => {
    let value = BigInt.asUintN(64, BigInt(n));
    const bytes: number[] = [];
    do {
        const byte = Number(value & 127n);
        value >>= 7n;
        bytes.push(byte | (value ? 128 : 0));
    } while (value);
    return Uint8Array.from(bytes);
};
const text = (s: string) => new TextEncoder().encode(s);
const msg = (key: number, data: Uint8Array) => join(v(key * 8 + 2), v(data.length), data);
const num = (key: number, n: number) => join(v(key * 8), v(n));
const bytes = (values: number[]) => new Uint8Array(new Float32Array(values).buffer);
const tensor = (name: string, type: number, dims: number[], raw: Uint8Array) =>
    msg(5, join(...dims.map(dim => num(1, dim)), num(2, type), msg(8, text(name)), msg(9, raw)));
const mm = msg(1, join(msg(1, text('audio')), msg(1, text('weight')), msg(2, text('output')), msg(4, text('MatMul'))));
const model = (...graph: Uint8Array[]) => join(num(1, 8), msg(7, join(...graph)), msg(6, text('preserved metadata')));
function quantized(axis = 0, scaleValues = [0.5, 2], zeroType = 3) {
    const dq = msg(
        1,
        join(
            msg(1, text('q')),
            msg(1, text('scale')),
            msg(1, text('zero')),
            msg(2, text('weight')),
            msg(4, text('DequantizeLinear')),
            msg(5, join(msg(1, text('axis')), num(3, axis), num(20, 2))),
        ),
    );
    return model(
        dq,
        mm,
        tensor('q', 3, [2, 2], Uint8Array.of(254, 255, 0, 1)),
        tensor('scale', 1, [scaleValues.length], bytes(scaleValues)),
        tensor('zero', zeroType, [2], Uint8Array.of(0, 0)),
    );
}

describe('static ONNX weight expansion', () => {
    it('expands signed per-row scales and preserves the remaining graph and metadata', async () => {
        const expanded = await expandQuantizedConstants(quantized(), new AbortController().signal);
        expect(expanded).toEqual(model(mm, tensor('weight', 1, [2, 2], bytes([-1, -0.5, 0, 2]))));
    });
    it('supports a negative last axis', async () => {
        const expanded = await expandQuantizedConstants(quantized(-1), new AbortController().signal);
        expect(expanded).toEqual(model(mm, tensor('weight', 1, [2, 2], bytes([-1, -2, 0, 2]))));
    });
    it('leaves a graph with no constant dequantization unchanged', async () => {
        const original = model(mm);
        expect(await expandQuantizedConstants(original, new AbortController().signal)).toBe(original);
    });
    it('rejects invalid scales, type mismatches and truncated model bytes', async () => {
        await expect(
            expandQuantizedConstants(quantized(0, [0, 2]), new AbortController().signal),
        ).rejects.toMatchObject({ code: 'model-incompatible' });
        await expect(
            expandQuantizedConstants(quantized(0, [0.5, 2], 2), new AbortController().signal),
        ).rejects.toMatchObject({ code: 'model-incompatible' });
        await expect(
            expandQuantizedConstants(quantized().subarray(0, 9), new AbortController().signal),
        ).rejects.toMatchObject({ code: 'model-incompatible' });
    });
    it('preserves cancellation rather than reporting an incompatible model', async () => {
        const abort = new AbortController();
        abort.abort();
        await expect(expandQuantizedConstants(quantized(), abort.signal)).rejects.toMatchObject({
            code: 'job-cancelled',
        });
    });
});
