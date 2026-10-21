import { describe, expect, test } from 'vitest';
import {
    KeyboardMarkerRecorder,
    keyboardMarkerTargets,
    type KeyboardRangeRecording,
} from '../../src/editor/keyboardMarkerRecording';
import { DEFAULT_BEAT_SNAP } from '../../src/editor/beatSnap';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { addPointInnerClass, createPointEvent, createPointLane } from '../../src/editor/pointAnnotations';
import { createRangeEvent, createRangeLane } from '../../src/editor/rangeAnnotations';
import type { PlaybackSnapshot } from '../../src/types/audio';
import type { EditorProjectV2, PointLaneV1, RangeLaneV1 } from '../../src/editor/types';

function harness(kinds: ('point' | 'range')[] = ['point', 'range']) {
    let project = createInitialEditorProject({
        track: { contentHash: 'a'.repeat(64), fileName: 'recording.wav', durationSeconds: 8, sampleRate: 48000 },
    });
    project.tempoMap = [
        {
            id: 'tempo',
            mode: 'metered',
            beatOriginSeconds: 0,
            startSeconds: 0,
            bpm: 120,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        },
    ];
    for (const kind of kinds) project = (kind === 'point' ? createPointLane : createRangeLane)(project);
    let snapshot: PlaybackSnapshot = {
        trackId: 'song',
        state: 'playing',
        currentTimeSeconds: 1.06,
        durationSeconds: 8,
        volume: 1,
        playbackRate: 1,
    };
    let active = true,
        pending: readonly KeyboardRangeRecording[] = [],
        writes = 0,
        revision = 0;
    const setting = { ...DEFAULT_BEAT_SNAP },
        messages: string[] = [];
    const recorder = new KeyboardMarkerRecorder({
        getContext: () => ({ trackId: 'song', project, revision }),
        active: () => active,
        setting: () => setting,
        playback: () => snapshot,
        publish: value => {
            project = value;
            writes += 1;
        },
        report: value => messages.push(value),
        changed: value => (pending = value),
    });
    return {
        recorder,
        setting,
        messages,
        replaceSameProject() {
            project = structuredClone(project);
            revision += 1;
            recorder.reconcile();
        },
        get project() {
            return project;
        },
        get pending() {
            return pending;
        },
        get writes() {
            return writes;
        },
        setProject(value: EditorProjectV2) {
            project = value;
        },
        setActive(value: boolean) {
            active = value;
            recorder.reconcile();
        },
        time(value: number) {
            snapshot = { ...snapshot, currentTimeSeconds: value };
        },
        state(state: PlaybackSnapshot['state'], trackId = 'song') {
            snapshot = { ...snapshot, state, trackId };
            recorder.playbackChanged(snapshot);
        },
    };
}

describe('keyboard marker recording', () => {
    test('numbers classification rows in mixed project order, caps at ten and recomputes after deletion', () => {
        const h = harness(['range', 'point']);
        let project = h.project;
        const lane = project.lanes[1]!;
        for (let i = 0; i < 10; i++) project = addPointInnerClass(project, lane.id);
        const rows = keyboardMarkerTargets(project);
        expect(rows).toHaveLength(10);
        expect(rows.map(row => row.key)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
        expect(rows[0]).toMatchObject({ laneId: project.lanes[0]!.id, eventKind: 'range' });
        expect(rows[2]!.innerClassId).toBe(project.lanes[1]!.innerClasses[1]!.id);
        expect(keyboardMarkerTargets({ ...project, lanes: project.lanes.slice(1) })[0]!.laneId).toBe(lane.id);
    });

    test('samples keydown position, ignores repeats and keypad aliases; new presses use latest project', () => {
        const h = harness();
        h.recorder.down('1', 'Digit1');
        h.time(1.44);
        h.recorder.down('1', 'Digit1', true);
        h.recorder.down('1', 'Numpad1');
        expect(h.writes).toBe(1);
        h.recorder.up('Numpad1');
        h.recorder.up('Digit1');
        h.time(1.07);
        h.recorder.down('1', 'Numpad1');
        h.recorder.up('Numpad1');
        expect((h.project.lanes[0] as PointLaneV1).events.map(event => event.atSeconds)).toEqual([1, 1.125]);
        h.recorder.down('1', 'Digit1');
        h.recorder.up('Digit1');
        expect(h.writes).toBe(2);
        expect(h.messages.at(-1)).toContain('已经有');
    });

    test('range samples each endpoint and only writes on release; short release extends one grid unit', () => {
        const h = harness(['range']);
        h.recorder.down('1', 'Digit1');
        expect(h.pending[0]!.startSeconds).toBe(1);
        expect(h.writes).toBe(0);
        h.time(1.44);
        h.recorder.up('Digit1');
        expect((h.project.lanes[0] as RangeLaneV1).events[0]).toMatchObject({ startSeconds: 1, endSeconds: 1.5 });
        h.time(2.01);
        h.recorder.down('1', 'Numpad1');
        h.time(2.02);
        h.recorder.up('Numpad1');
        expect((h.project.lanes[0] as RangeLaneV1).events[1]).toMatchObject({ startSeconds: 2, endSeconds: 2.125 });
        expect(h.pending).toHaveLength(0);
    });

    test('pause commits simultaneous ranges once, independently preserves successful rows and never restarts held keys', () => {
        const h = harness(['range', 'range', 'point']);
        h.recorder.down('1', 'Digit1');
        h.recorder.down('2', 'Digit2');
        h.recorder.down('3', 'Digit3');
        h.time(1.7);
        h.state('paused');
        expect(h.writes).toBe(2);
        expect(h.project.lanes.map(lane => lane.events.length)).toEqual([1, 1, 1]);
        h.state('playing');
        h.recorder.down('1', 'Digit1', true);
        expect(h.pending).toHaveLength(0);
        h.recorder.up('Digit1');
        expect(h.writes).toBe(2);
        const first = h.project.lanes[0] as RangeLaneV1;
        h.setProject(createRangeEvent(h.project, first.id, first.innerClasses[0]!.id, 2, 3).project);
        h.time(2.1);
        h.recorder.down('1', 'Digit1');
        h.recorder.up('Digit2');
        h.recorder.down('2', 'Digit2');
        h.time(2.5);
        h.state('paused');
        expect(h.project.lanes.map(lane => lane.events.length)).toEqual([2, 2, 1]);
        expect(h.messages.at(-1)).toContain('重叠');
    });

    test('stopping a too-short range does not extend; end completes before repeat and no legal final cell rejects', () => {
        const h = harness(['range']);
        h.time(1.01);
        h.recorder.down('1', 'Digit1');
        h.time(1.02);
        h.state('paused');
        expect(h.writes).toBe(0);
        expect(h.messages.at(-1)).toContain('不足一格');
        h.recorder.up('Digit1');
        h.state('playing');
        h.time(7.6);
        h.recorder.down('1', 'Digit1');
        h.time(8);
        h.state('ended');
        expect((h.project.lanes[0] as RangeLaneV1).events[0]).toMatchObject({ startSeconds: 7.625, endSeconds: 8 });
        h.time(0);
        h.state('playing');
        h.recorder.down('1', 'Digit1', true);
        expect(h.pending).toHaveLength(0);
        h.recorder.up('Digit1');
        h.time(7.99);
        h.recorder.down('1', 'Digit1');
        h.recorder.up('Digit1');
        expect(h.writes).toBe(1);
    });

    test('cancel, tab change, buffering, track mismatch and source or grid revisions discard only pending recording', () => {
        for (const cancel of [
            'cancel',
            'inactive',
            'buffering',
            'track',
            'project',
            'import',
            'tempo',
            'setting',
            'rows',
        ]) {
            const h = harness();
            h.recorder.down('2', 'Digit2');
            if (cancel === 'cancel') h.recorder.cancel();
            if (cancel === 'inactive') h.setActive(false);
            if (cancel === 'buffering') h.state('buffering');
            if (cancel === 'track') h.state('playing', 'other');
            if (cancel === 'project') h.setProject({ ...h.project, projectId: 'replaced' });
            if (cancel === 'import') h.replaceSameProject();
            if (cancel === 'tempo')
                h.setProject({ ...h.project, tempoMap: [{ ...h.project.tempoMap[0]!, startSeconds: 0.1 }] });
            if (cancel === 'setting') h.setting.divisor = 8;
            if (cancel === 'rows') h.setProject({ ...h.project, lanes: h.project.lanes.toReversed() });
            h.time(2);
            h.recorder.up('Digit2');
            expect(h.writes, cancel).toBe(0);
        }
    });

    test('uses cross-tempo and single-beat candidates; absent BPM refuses unsnapped events', () => {
        const h = harness();
        h.setProject({
            ...h.project,
            tempoMap: [
                h.project.tempoMap[0]!,
                {
                    id: 'slow',
                    startSeconds: 2,
                    mode: 'metered',
                    beatOriginSeconds: 2,
                    bpm: 60,
                    bpmSource: 'user',
                    meter: { numerator: 3, denominator: 4 },
                },
            ],
        });
        h.time(1.9);
        h.recorder.down('2', 'Digit2');
        h.time(2.39);
        h.recorder.up('Digit2');
        expect((h.project.lanes[1] as RangeLaneV1).events[0]).toMatchObject({ startSeconds: 1.875, endSeconds: 2.5 });
        h.setProject({ ...h.project, tempoMap: [{ id: 'single', mode: 'single-beat', startSeconds: 0 }] });
        h.time(3);
        h.recorder.down('1', 'Digit1');
        h.recorder.up('Digit1');
        expect((h.project.lanes[0] as PointLaneV1).events[0]!.atSeconds).toBe(0);
        h.setProject({
            ...h.project,
            tempoMap: [
                {
                    id: 'unset',
                    startSeconds: 0,
                    mode: 'metered',
                    beatOriginSeconds: 0,
                    bpm: null,
                    bpmSource: 'unset',
                    meter: { numerator: 4, denominator: 4 },
                },
            ],
        });
        h.recorder.down('1', 'Digit1');
        expect(h.messages.at(-1)).toContain('设置 BPM');
        expect(h.writes).toBe(2);
    });

    test('unrelated event changes remain present when finishing a held range', () => {
        const h = harness();
        h.recorder.down('2', 'Digit2');
        const lane = h.project.lanes[0]!;
        h.setProject(createPointEvent(h.project, lane.id, lane.innerClasses[0]!.id, 4).project);
        h.time(2);
        h.recorder.up('Digit2');
        expect(h.project.lanes.map(value => value.events.length)).toEqual([1, 1]);
    });
});
