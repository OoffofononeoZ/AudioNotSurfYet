// Deterministic constant expansion for the pinned ADT_STR browser export.
// Reference: Coming Undone browser/src/onnxwire.js (MIT), revision
// 5188633e9fbdf5812c943214385f065b73260f80. Model adaptations remain CC BY-SA 4.0.
import { checkCancelled, ProcessingError } from '../processing/modelManifest';

export const CONSTANT_EXPANSION_VERSION = 'adt-static-dequant-f32-v1';
const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();
interface Field {
    number: number;
    wire: number;
    start: number;
    end: number;
    payload: Uint8Array;
}
interface Tensor {
    name: string;
    type: number;
    dims: number[];
    raw: Uint8Array;
}

function integer(bytes: Uint8Array, position: { at: number }): bigint {
    let result = 0n;
    for (let shift = 0n; shift < 70n; shift += 7n) {
        if (position.at >= bytes.length) throw Error('Truncated protobuf integer.');
        const byte = bytes[position.at++]!;
        result |= BigInt(byte & 127) << shift;
        if (!(byte & 128)) return result;
    }
    throw Error('Invalid protobuf integer.');
}

function safeNumber(value: bigint): number {
    const result = Number(value);
    if (!Number.isSafeInteger(result)) throw Error('Unsafe protobuf integer.');
    return result;
}

function fields(bytes: Uint8Array): Field[] {
    const result: Field[] = [],
        position = { at: 0 };
    while (position.at < bytes.length) {
        const start = position.at,
            tag = safeNumber(integer(bytes, position));
        const wire = tag & 7,
            number = tag >>> 3;
        let payloadStart = position.at;
        if (!number) throw Error('Invalid protobuf field.');
        if (wire === 0) integer(bytes, position);
        else if (wire === 1) position.at += 8;
        else if (wire === 5) position.at += 4;
        else if (wire === 2) {
            const length = safeNumber(integer(bytes, position));
            payloadStart = position.at;
            position.at += length;
        } else throw Error('Unsupported protobuf wire type.');
        if (position.at > bytes.length) throw Error('Truncated protobuf field.');
        result.push({ number, wire, start, end: position.at, payload: bytes.subarray(payloadStart, position.at) });
    }
    return result;
}

function varint(value: number): Uint8Array {
    const bytes: number[] = [];
    let rest = BigInt(value);
    do {
        let byte = Number(rest & 127n);
        rest >>= 7n;
        if (rest) byte |= 128;
        bytes.push(byte);
    } while (rest);
    return Uint8Array.from(bytes);
}

function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

function message(number: number, payload: Uint8Array): Uint8Array {
    return concat([varint(number * 8 + 2), varint(payload.length), payload]);
}

function tensor(bytes: Uint8Array): Tensor {
    const result: Tensor = { name: '', type: 0, dims: [], raw: new Uint8Array() };
    for (const field of fields(bytes)) {
        if (field.number === 8) result.name = decoder.decode(field.payload);
        if (field.number === 2) result.type = safeNumber(integer(field.payload, { at: 0 }));
        if (field.number === 9) result.raw = field.payload;
        if ([4, 5, 7].includes(field.number)) throw Error('Expected raw_data ONNX initializers.');
        if (field.number === 1) {
            const position = { at: 0 };
            do {
                result.dims.push(safeNumber(integer(field.payload, position)));
            } while (position.at < field.payload.length);
        }
    }
    return result;
}

function floatTensor(name: string, dims: number[], values: Float32Array): Uint8Array {
    return concat([
        ...dims.map(dim => concat([varint(8), varint(dim)])),
        Uint8Array.of(16, 1),
        message(8, encoder.encode(name)),
        message(9, new Uint8Array(values.buffer, values.byteOffset, values.byteLength)),
    ]);
}

/** Expand only static DequantizeLinear constants; leave every unrelated field intact. */
export async function expandQuantizedConstants(bytes: Uint8Array, signal: AbortSignal): Promise<Uint8Array> {
    try {
        checkCancelled(signal);
        const modelFields = fields(bytes),
            graphField = modelFields.find(field => field.number === 7);
        if (!graphField) throw Error('ONNX graph missing.');
        const graph = graphField.payload,
            graphFields = fields(graph);
        const initializers = new Map<string, Tensor>();
        for (const field of graphFields.filter(field => field.number === 5)) {
            const value = tensor(field.payload);
            initializers.set(value.name, value);
        }
        const dropped = new Set<number>(),
            replacedInputs = new Set<string>(),
            appended: Uint8Array[] = [];
        const remainingInputs = new Set<string>();
        for (const field of graphFields.filter(field => field.number === 1)) {
            checkCancelled(signal);
            const node = fields(field.payload);
            const input = node.filter(part => part.number === 1).map(part => decoder.decode(part.payload));
            const output = node.filter(part => part.number === 2).map(part => decoder.decode(part.payload));
            const op = decoder.decode(node.find(part => part.number === 4)?.payload);
            if (op !== 'DequantizeLinear' || !input.every(name => initializers.has(name))) {
                input.forEach(name => remainingInputs.add(name));
                continue;
            }
            if (input.length !== 3 || output.length !== 1) throw Error('Unsupported static dequantization signature.');
            const [quantized, scale, zero] = input.map(name => initializers.get(name)!);
            if (
                ![2, 3].includes(quantized!.type) ||
                zero!.type !== quantized!.type ||
                scale!.type !== 1 ||
                scale!.raw.length % 4 ||
                quantized!.dims.some(dim => dim <= 0) ||
                quantized!.dims.reduce((a, b) => a * b, 1) !== quantized!.raw.length
            )
                throw Error('Unsupported quantized initializer.');
            const scales = new Float32Array(new Uint8Array(scale!.raw).buffer);
            if (!scales.length || scales.some(value => !Number.isFinite(value) || value <= 0))
                throw Error('Invalid dequantization scale.');
            let axis = 1;
            for (const attribute of node.filter(part => part.number === 5)) {
                const parts = fields(attribute.payload);
                const name = decoder.decode(parts.find(part => part.number === 1)?.payload);
                if (name === 'axis')
                    axis = safeNumber(
                        BigInt.asIntN(64, integer(parts.find(part => part.number === 3)!.payload, { at: 0 })),
                    );
                else if (name !== 'axis') throw Error('Unsupported dequantization attribute.');
            }
            if (axis < 0) axis += quantized!.dims.length;
            if (
                scales.length !== 1 &&
                (axis < 0 || axis >= quantized!.dims.length || quantized!.dims[axis] !== scales.length)
            )
                throw Error('Invalid quantization axis.');
            if (zero!.raw.length !== scales.length) throw Error('Invalid dequantization zero point.');
            const inner =
                scales.length === 1
                    ? quantized!.raw.length
                    : quantized!.dims.slice(axis + 1).reduce((a, b) => a * b, 1);
            const signed = quantized!.type === 3,
                values = new Float32Array(quantized!.raw.length);
            for (let i = 0; i < values.length; i++) {
                const channel = scales.length === 1 ? 0 : Math.floor(i / inner) % scales.length;
                const q = signed ? (quantized!.raw[i]! << 24) >> 24 : quantized!.raw[i]!;
                const z = signed ? (zero!.raw[channel]! << 24) >> 24 : zero!.raw[channel]!;
                values[i] = (q - z) * scales[channel]!;
            }
            appended.push(message(5, floatTensor(output[0]!, quantized!.dims, values)));
            input.forEach(name => replacedInputs.add(name));
            dropped.add(field.start);
            await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
        const parts: Uint8Array[] = [];
        for (const field of graphFields) {
            if (dropped.has(field.start)) continue;
            if (field.number === 5) {
                const name = tensor(field.payload).name;
                if (replacedInputs.has(name) && !remainingInputs.has(name)) continue;
            }
            parts.push(graph.subarray(field.start, field.end));
        }
        checkCancelled(signal);
        if (!appended.length) return bytes;
        const rewritten = message(7, concat([...parts, ...appended]));
        return concat(
            modelFields.map(field => (field === graphField ? rewritten : bytes.subarray(field.start, field.end))),
        );
    } catch (error) {
        checkCancelled(signal);
        throw new ProcessingError(
            error instanceof RangeError ? 'memory-unavailable' : 'model-incompatible',
            `ADT constant expansion: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}
