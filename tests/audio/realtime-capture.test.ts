import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test, expect } from 'vitest';

test('audio worklet accepts variable render quanta and stops capture when all four transfer buffers are in flight', () => {
    let Processor: any;
    const messages: any[] = [];
    const context = vm.createContext({
        AudioWorkletProcessor: class {
            port: any = {};
        },
        registerProcessor(_name: string, factory: any) {
            Processor = factory;
        },
        Float32Array,
    });
    new vm.Script(
        readFileSync(new URL('../../src/audio/realtimeCapture.worklet.js', import.meta.url), 'utf8'),
    ).runInContext(context);
    const instance = new Processor();
    const port = {
        start() {},
        postMessage(message: unknown, transfer?: Transferable[]) {
            messages.push(structuredClone(message, { transfer }));
        },
    };
    instance.port.onmessage({ data: { kind: 'connect', port } });
    for (let i = 0; i < 32; i++) expect(instance.process([[new Float32Array(127), new Float32Array(127)]])).toBe(true);
    instance.process([[new Float32Array(64), new Float32Array(64)]]);
    expect(messages.filter(message => message.kind === 'pcm')).toHaveLength(4);
    expect(messages.at(-1)).toMatchObject({ kind: 'fatal', message: expect.stringContaining('跟不上') });
    instance.process([[new Float32Array(1024), new Float32Array(1024)]]);
    expect(messages.filter(message => message.kind === 'pcm')).toHaveLength(4);
});
