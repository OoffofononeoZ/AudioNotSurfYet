import { describe, expect, it } from 'vitest';
import { StemAnalysisRuntime } from '../../src/analysis/stemAnalysisRuntime';
import type { EditorSeparationService, EditorSeparationSnapshot } from '../../src/processing/editorSeparationService';
import type { StemWorkerRequest } from '../../src/analysis/stemProtocol';

function harness() {
    let state = { status: 'idle', trackId: 'current', result: null } as EditorSeparationSnapshot;
    let listener: () => void = () => {},
        release: () => Promise<void> = async () => {};
    let runtime!: StemAnalysisRuntime;
    const sent: StemWorkerRequest[] = [];
    const service = {
        getSnapshot: () => state,
        subscribe: (value: () => void) => {
            listener = value;
            listener();
            return () => {};
        },
        registerSourceConsumer: (value: () => Promise<void>) => {
            release = value;
            return () => {};
        },
    } as unknown as EditorSeparationService;
    runtime = new StemAnalysisRuntime(
        service,
        () => ({ id: 'current', hash: 'current-hash' }),
        message => {
            sent.push(message);
            if (message.kind === 'stem-clear')
                queueMicrotask(() =>
                    runtime.handle({ kind: 'stem-cleared', requestId: message.requestId, epoch: message.epoch }),
                );
        },
        () => {},
    );
    return {
        runtime,
        sent,
        release: () => release(),
        emit: (patch: Partial<EditorSeparationSnapshot>) => {
            state = { ...state, ...patch };
            listener();
        },
    };
}
describe('stem source lifecycle', () => {
    it('republishes unresolved references after cleanup releases its consumers', async () => {
        const h = harness();
        h.runtime.setRequests([{ stemRole: 'drums', featureId: 'energy' }]);
        h.emit({ status: 'clearing' });
        await h.release();
        h.emit({ status: 'idle', result: null });
        expect(h.runtime.getSnapshot('drums')).toMatchObject({
            state: 'error',
            activeFeatureIds: ['energy'],
            error: { code: 'audio-not-ready' },
        });
        expect(h.sent.some(m => m.kind === 'stem-analyze')).toBe(false);
        await h.runtime.dispose();
    });
    it('does not relabel an old song result with the current song hash', async () => {
        const h = harness();
        h.emit({
            status: 'ready',
            trackId: 'old-song',
            result: {
                source: { directory: 'old-result', descriptor: { trackId: 'old-song' } },
            } as EditorSeparationSnapshot['result'],
        });
        h.runtime.setRequests([{ stemRole: 'vocals', featureId: 'buffer' }]);
        expect(h.runtime.getSnapshot('vocals')).toMatchObject({
            state: 'error',
            trackId: 'current',
            trackHash: 'current-hash',
        });
        expect(h.sent.some(m => m.kind === 'stem-analyze')).toBe(false);
        await h.runtime.dispose();
    });
});
