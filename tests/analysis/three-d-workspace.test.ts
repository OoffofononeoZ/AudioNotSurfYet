import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { presentationQueue, THREE_D_FEATURE_IDS, validatePresentation } from '../../src/analysis/threeDFeatures';
import { validatePersistedSessionV1 } from '../../src/persistence/sessionRepository';
import { DEFAULT_PERSISTED_ANALYSIS_CONFIG } from '../../src/types/session';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';

describe('independent 3D workspace', () => {
    const base = {
        schemaVersion: 1,
        analyzerWorkspaceVersion: 2,
        savedAt: '2026-11-02',
        queue: [],
        currentTrackId: null,
        handles: [],
        activeCards: [],
        viewport: null,
        analysisConfig: DEFAULT_PERSISTED_ANALYSIS_CONFIG,
    };
    it('preserves existing sessions without presentation metadata', () => {
        const session = validatePersistedSessionV1(base);
        expect(session.analysisPresentation).toBeUndefined();
        expect(presentationQueue(undefined, ['rms', 'energy'])).toEqual(['rms', 'energy']);
    });
    it('round trips all seven choices separately from the original queue and clones state', () => {
        setActivePinia(createPinia());
        for (const featureId of THREE_D_FEATURE_IDS) {
            const presentation = { originalMode: '3d' as const, threeDFeatureId: featureId };
            const session = validatePersistedSessionV1({
                ...base,
                activeCards: [{ slot: 0, featureId: 'rms' }],
                analysisPresentation: presentation,
            });
            const store = useAudioSessionStore();
            store.hydrateSession([], null, 1, {
                activeFeatureQueue: ['rms'],
                viewport: null,
                presentation: session.analysisPresentation,
            });
            expect(store.analysisWorkspace.presentation).toEqual(presentation);
            expect(presentationQueue(presentation, store.analysisWorkspace.activeFeatureQueue)).toEqual([featureId]);
            presentation.originalMode = '2d' as '3d';
            expect(store.analysisWorkspace.presentation?.originalMode).toBe('3d');
            expect(store.analysisWorkspace.activeFeatureQueue).toEqual(['rms']);
            store.clearSession();
            expect(store.analysisWorkspace.presentation).toBeUndefined();
        }
        expect(presentationQueue({ originalMode: '3d', threeDFeatureId: null }, ['energy'])).toEqual([]);
    });
    it('rejects unsupported selections, malformed modes and unknown fields', () => {
        for (const value of [
            null,
            [],
            {},
            { originalMode: '3d', threeDFeatureId: 'buffer' },
            { originalMode: '3d', threeDFeatureId: ['mfcc'] },
            { originalMode: '2d', threeDFeatureId: null, other: 1 },
            { originalMode: '4d', threeDFeatureId: null },
        ]) {
            expect(() => validatePresentation(value)).toThrow();
            expect(() => validatePersistedSessionV1({ ...base, analysisPresentation: value })).toThrow();
        }
    });
});
