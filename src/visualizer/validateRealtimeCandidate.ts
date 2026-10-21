import type { RealtimeStyleV1 } from './realtimeStyle';
import { IsolatedAlgorithmRuntime } from './isolatedAlgorithmRuntime';
import { RealtimeResolver } from './realtimeResolver';
import { findResource } from './elementRegistry';
import { parameterKey } from './compositionEffects';
import { resolveSessionSeed } from './seed';

/** Validate executable frame-only behavior before publishing a local snapshot. */
export async function validateRealtimeCandidate(style: RealtimeStyleV1, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const runtime = new IsolatedAlgorithmRuntime();
    const seed = resolveSessionSeed(style.seed);
    const abort = () => runtime.dispose(Error('实时样式验证已取消。'));
    signal?.addEventListener('abort', abort, { once: true });
    try {
        await runtime.initialize(
            style.elements.map(e => ({
                id: e.id,
                algorithm: findResource(
                    style.resources.algorithms,
                    findResource(style.resources.elements, e.resource).algorithm,
                ),
            })),
        );
        const values = new RealtimeResolver().resolve(style, 0, {}, null);
        await runtime.prepareFrames(
            style.elements.map(e => ({
                id: e.id,
                frame: {
                    time: 0,
                    seed,
                    revision: '0',
                    width: 1920,
                    height: 1080,
                    range: null,
                    parameters: Object.fromEntries(
                        e.bindings.map(b => {
                            const v = values.get(parameterKey(e.id, b.parameterId))!;
                            return [b.parameterId, { value: v.value!, ...(v.unit ? { unit: v.unit } : {}) }];
                        }),
                    ),
                },
            })),
            async () => {
                throw Error('实时样式不能查询历史输入。');
            },
            signal,
        );
        signal?.throwIfAborted();
    } finally {
        signal?.removeEventListener('abort', abort);
        runtime.dispose();
    }
}
