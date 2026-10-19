import { IsolatedAlgorithmRuntime } from './isolatedAlgorithmRuntime';
import { findResource } from './elementRegistry';
import { resourceKey } from './resourceIdentity';
import type { ResourceSnapshot } from './resourceTypes';

/** Pure decoding is separate from executable initialization; candidates never touch the active project. */
export async function validateRuntimeSnapshot(snapshot: ResourceSnapshot, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (!snapshot.elements.length) return;
    const runtime = new IsolatedAlgorithmRuntime();
    const abort = () => runtime.dispose(Error('资源初始化已取消。'));
    signal?.addEventListener('abort', abort, { once: true });
    try {
        await runtime.initialize(
            snapshot.elements.map(e => ({
                id: resourceKey(e),
                algorithm: findResource(snapshot.algorithms, e.algorithm),
            })),
        );
        signal?.throwIfAborted();
    } finally {
        signal?.removeEventListener('abort', abort);
        runtime.dispose();
    }
}
