import type { AlgorithmDefinition, AlgorithmInstance, DrawPacket } from '../../src/visualizer/algorithmTypes';
import type { AlgorithmRuntimePort } from '../../src/visualizer/compositionScene';
import type { MarkerReader } from '../../src/visualizer/editorMarkerTypes';
import type { RuntimeElement, RuntimeFrame, HistoryReader } from '../../src/visualizer/isolatedAlgorithmRuntime';
import { validateDrawPacket } from '../../src/visualizer/drawPacket';

/** Node-only GPU composition fixture; browser tests exercise the actual security boundary. */
export async function createTestAlgorithm(algorithm: AlgorithmDefinition): Promise<AlgorithmInstance> {
    const url = 'data:text/javascript;base64,' + Buffer.from(algorithm.source).toString('base64');
    const module = await import(/* @vite-ignore */ url);
    return module.create() as AlgorithmInstance;
}
export class AlgorithmRuntimeFixture implements AlgorithmRuntimePort {
    private instances = new Map<string, { algorithm: AlgorithmDefinition; instance: AlgorithmInstance }>();
    async initialize(elements: RuntimeElement[]) {
        for (const e of elements)
            this.instances.set(e.id, { algorithm: e.algorithm, instance: await createTestAlgorithm(e.algorithm) });
    }
    async prepareFrames(frames: RuntimeFrame[], history: HistoryReader, _signal?: AbortSignal, markers?: MarkerReader) {
        const result = new Map<string, DrawPacket>();
        for (const e of frames) {
            const { algorithm, instance } = this.instances.get(e.id)!;
            const packet = await instance.prepareFrame(e.frame, {
                history: request => history(e.id, request),
                markers: request => {
                    if (!markers) throw Error('No marker reader');
                    return markers(e.id, request);
                },
            });
            result.set(e.id, validateDrawPacket(packet, algorithm));
        }
        return result;
    }
    dispose() {
        for (const { instance } of this.instances.values()) instance.dispose?.();
        this.instances.clear();
    }
}
