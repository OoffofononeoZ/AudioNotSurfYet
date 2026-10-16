import {
    describe,
    expect,
    test,
} from 'vitest';
import {
    MAX_ACTIVE_FEATURES,
    toggleActiveFeature,
} from '../../src/analysis/activeFeatureQueue';
import {
    activeCardsToFeatureQueue,
    activeFeatureQueueToCards,
    assertValidAnalysisWorkspace,
    assertValidPersistedActiveCards,
} from '../../src/types/session';

describe('M13 FIFO active feature queue', () => {
    test('appends one through four unique features', () => {
        let queue = [] as ReturnType<typeof toggleActiveFeature>['queue'];
        for (const featureId of [
            'rms', 'chroma', 'energy', 'mfcc',
        ] as const) {
            const transition = toggleActiveFeature(queue, featureId);
            expect(transition.expanded).toBe(true);
            expect(transition.evictedFeatureId).toBeNull();
            queue = transition.queue;
        }
        expect(queue).toEqual(['rms', 'chroma', 'energy', 'mfcc']);
        expect(queue).toHaveLength(MAX_ACTIVE_FEATURES);
    });

    test('evicts the oldest item atomically for the fifth feature', () => {
        expect(toggleActiveFeature(
            ['rms', 'chroma', 'energy', 'mfcc'],
            'buffer',
        )).toEqual({
            queue: ['chroma', 'energy', 'mfcc', 'buffer'],
            evictedFeatureId: 'rms',
            expanded: true,
        });
    });

    test('collapses an active item and re-expands it at the tail', () => {
        const collapsed = toggleActiveFeature(
            ['rms', 'chroma', 'energy'],
            'chroma',
        );
        expect(collapsed).toEqual({
            queue: ['rms', 'energy'],
            evictedFeatureId: null,
            expanded: false,
        });
        expect(toggleActiveFeature(collapsed.queue, 'chroma').queue)
            .toEqual(['rms', 'energy', 'chroma']);
    });

    test('keeps rapid sequences unique and capped', () => {
        const sequence = [
            'rms', 'chroma', 'energy', 'mfcc', 'buffer',
            'energy', 'energy', 'loudness', 'rms',
        ] as const;
        const queue = sequence.reduce(
            (current, featureId) =>
                toggleActiveFeature(current, featureId).queue,
            [] as ReturnType<typeof toggleActiveFeature>['queue'],
        );
        expect(queue).toEqual(['buffer', 'energy', 'loudness', 'rms']);
        expect(new Set(queue).size).toBe(queue.length);
        expect(queue.length).toBeLessThanOrEqual(MAX_ACTIVE_FEATURES);
    });
});

describe('M13 PersistedSessionV1 activeCards adapter', () => {
    test('restores by slot and saves queue order without a schema bump', () => {
        const cards = [
            { slot: 2 as const, featureId: 'buffer' as const },
            { slot: 0 as const, featureId: 'rms' as const },
            { slot: 1 as const, featureId: 'chroma' as const },
        ];
        expect(activeCardsToFeatureQueue(cards))
            .toEqual(['rms', 'chroma', 'buffer']);
        expect(activeFeatureQueueToCards(['rms', 'chroma', 'buffer']))
            .toEqual([
                { slot: 0, featureId: 'rms' },
                { slot: 1, featureId: 'chroma' },
                { slot: 2, featureId: 'buffer' },
            ]);
    });

    test('validates runtime queue and persisted carrier independently', () => {
        expect(() => assertValidAnalysisWorkspace({
            activeFeatureQueue: ['rms', 'chroma'],
            viewport: null,
        })).not.toThrow();
        expect(() => assertValidPersistedActiveCards([
            { slot: 0, featureId: 'rms' },
            { slot: 0, featureId: 'chroma' },
        ])).toThrow(/unique slots/);
    });
});
