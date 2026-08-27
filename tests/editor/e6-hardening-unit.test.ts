import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { visiblePointEvents } from '../../src/editor/pointAnnotations';
import { rangesOverlap, visibleRangeEvents } from '../../src/editor/rangeAnnotations';
import type { PointLaneV1, RangeLaneV1 } from '../../src/editor/types';
import {
    buildE6StressProject,
    E6_STRESS_DURATION_SECONDS,
    E6_STRESS_SEED,
    E6_STRESS_VIEWPORT,
    summarizeE6StressProject,
} from '../support/e6-stress-project';

const manifest = JSON.parse(readFileSync(path.resolve(
    import.meta.dirname,
    '../analysis/golden/editor-e6-stress.v1.json',
), 'utf8')) as {
    seed: number;
    canonicalSha256: string;
};

const project = buildE6StressProject({
    contentHash: 'e'.repeat(64),
    fileName: 'editor-e6-stress.wav',
    title: 'Editor E6 Stress',
    durationSeconds: E6_STRESS_DURATION_SECONDS,
    sampleRate: 48_000,
});

describe('Editor E6 deterministic hardening fixture', () => {
    test('creates the exact approved stress topology and digest', () => {
        const summary = summarizeE6StressProject(project);
        expect(summary).toMatchObject({
            seed: E6_STRESS_SEED,
            durationSeconds: 900,
            laneCount: 20,
            innerClassCount: 160,
            pointCount: 5_000,
            rangeCount: 5_000,
            eventCount: 10_000,
        });
        expect(summary.uniqueIdCount).toBe(summary.totalIdCount);
        expect(manifest.seed).toBe(E6_STRESS_SEED);
        expect(summary.sha256).toBe(manifest.canonicalSha256);
    });

    test('covers adjacent, cross-class and tail-boundary ranges without same-class overlap', () => {
        const rangeLanes = project.lanes.filter(
            (lane): lane is RangeLaneV1 => lane.eventKind === 'range',
        );
        const first = rangeLanes[0]!;
        const firstClass = first.innerClasses[0]!.id;
        const sameClass = first.events.filter(
            (event) => event.innerClassId === firstClass,
        );
        expect(sameClass[0]!.endSeconds).toBe(sameClass[1]!.startSeconds);
        const secondClassEvent = first.events.find(
            (event) => event.innerClassId === first.innerClasses[1]!.id,
        )!;
        expect(rangesOverlap(
            sameClass[0]!.startSeconds,
            sameClass[0]!.endSeconds,
            secondClassEvent.startSeconds,
            secondClassEvent.endSeconds,
        )).toBe(true);
        for (const lane of rangeLanes) {
            for (const innerClass of lane.innerClasses) {
                const events = lane.events.filter(
                    (event) => event.innerClassId === innerClass.id,
                );
                for (let index = 1; index < events.length; index += 1) {
                    expect(events[index]!.startSeconds)
                        .toBeGreaterThanOrEqual(events[index - 1]!.endSeconds);
                }
            }
        }
        expect(rangeLanes.at(-1)!.events.at(-1)!.endSeconds).toBe(900);
    });

    test('virtualizes event DOM inputs to the persisted viewport', () => {
        let visiblePoints = 0;
        let visibleRanges = 0;
        for (const lane of project.lanes) {
            for (const innerClass of lane.innerClasses) {
                if (lane.eventKind === 'point') {
                    visiblePoints += visiblePointEvents(
                        lane as PointLaneV1,
                        innerClass.id,
                        E6_STRESS_VIEWPORT,
                    ).length;
                } else {
                    visibleRanges += visibleRangeEvents(
                        lane as RangeLaneV1,
                        innerClass.id,
                        E6_STRESS_VIEWPORT,
                    ).length;
                }
            }
        }
        expect(visiblePoints).toBeGreaterThan(0);
        expect(visibleRanges).toBeGreaterThan(0);
        expect(visiblePoints + visibleRanges).toBeLessThan(10_000);
    });
});
