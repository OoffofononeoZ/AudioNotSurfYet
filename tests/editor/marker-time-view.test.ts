import { expect, test } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
    createMarkerTimeView,
    markerTimeToX,
    markerXToTime,
    markerCanEditAt,
    markerCellAtTime,
    markerEventReachable,
    editableMarkerBlock,
    assertMarkerBlockEditable,
} from '../../src/editor/markerTimeView';
import { EditorDraftRepository } from '../../src/editor/editorDraftRepository';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { createPointLane, createPointEvent } from '../../src/editor/pointAnnotations';
import { selectMarkerBlockByMeasures } from '../../src/editor/markerBlockOperations';

function project() {
    const value = createInitialEditorProject({
        track: { contentHash: 'a'.repeat(64), fileName: 'song.wav', durationSeconds: 900 },
    });
    value.tempoMap = [
        {
            id: 'first',
            startSeconds: 0,
            mode: 'metered',
            bpm: 120,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        },
        {
            id: 'second',
            startSeconds: 20,
            mode: 'metered',
            bpm: 90,
            bpmSource: 'user',
            meter: { numerator: 3, denominator: 4 },
        },
    ];
    return value;
}

test('fixed playhead geometry round trips at 1/10 seconds and preserves short-song padding', () => {
    for (const duration of [0.2, 12, 900])
        for (const cursor of [0, duration / 2, duration])
            for (const span of [1, 10]) {
                const view = createMarkerTimeView(cursor, duration, span);
                expect(Object.isFrozen(view)).toBe(true);
                expect(markerTimeToX(cursor, view, 800)).toBeCloseTo(120, 10);
                for (const time of [view.startSeconds, cursor, view.endSeconds])
                    expect(markerXToTime(markerTimeToX(time, view, 800), view, 800)).toBeCloseTo(time, 10);
                expect(view.endSeconds - view.startSeconds).toBeCloseTo(span);
            }
    expect(createMarkerTimeView(0, 0.2).startSeconds).toBe(-1.5);
    expect(createMarkerTimeView(0.2, 0.2).endSeconds).toBe(8.7);
    expect(createMarkerTimeView(5, 900, 100).spanSeconds).toBe(10);
    expect(createMarkerTimeView(5, 900, 0).spanSeconds).toBe(1);
});

test('playback is read-only; padding and valid song history remains editable', () => {
    const value = project(),
        view = createMarkerTimeView(0.13, 900);
    expect(markerCellAtTime(0.13, value, view, 800)?.timeSeconds).toBe(0.125);
    expect(markerCellAtTime(0.129, value, view, 800)?.timeSeconds).toBe(0.125);
    expect(markerCellAtTime(-0.2, value, view, 800)).toBeNull();
    expect(markerCanEditAt(createMarkerTimeView(0, 900, 10, true), 1)).toBe(false);
    expect(markerCellAtTime(900.1, value, createMarkerTimeView(900, 900), 800)).toBeNull();
    expect(markerCellAtTime(20, value, createMarkerTimeView(20, 900), 800)?.segmentId).toBe('second');
    value.tempoMap = [{ id: 'single', startSeconds: 0, mode: 'single-beat' }];
    expect(markerCellAtTime(1, value, createMarkerTimeView(1, 900), 800)?.timeSeconds).toBe(0);
});

test('crossing ranges remain reachable and new block selections include visible historical events', () => {
    const view = createMarkerTimeView(1, 900);
    expect(markerEventReachable(view, { id: 'r', innerClassId: 'c', startSeconds: 0, endSeconds: 2 })).toBe(true);
    expect(markerEventReachable(view, { id: 'r', innerClassId: 'c', startSeconds: 0, endSeconds: 1 })).toBe(true);
    let value = createPointLane(project());
    const lane = value.lanes[0]!;
    for (const time of [0.5, 1, 1.5])
        value = createPointEvent(value, lane.id, lane.innerClasses[0]!.id, time, () => `${time}`).project;
    const selection = editableMarkerBlock(
        value,
        selectMarkerBlockByMeasures(value, lane.id, lane.innerClasses[0]!.id, 1),
        view,
    );
    expect(selection.eventIds).toEqual(['0.5', '1', '1.5']);
    expect(() => assertMarkerBlockEditable(value, selection, view)).not.toThrow();
    expect(() => assertMarkerBlockEditable(value, selection, view, -0.625)).toThrow();
    expect(() => assertMarkerBlockEditable(value, selection, createMarkerTimeView(0, 900, 10, true))).toThrow();
});

test('waveform viewport cannot influence marker geometry; marker preferences do not write a draft', async () => {
    const value = project(),
        before = createMarkerTimeView(30, 900);
    value.workspace.viewport = { startSeconds: 500, endSeconds: 501, zoom: 900 };
    expect(createMarkerTimeView(30, value.track.durationSeconds)).toEqual(before);
    const repository = new EditorDraftRepository({ indexedDB: new IDBFactory(), databaseName: 'marker-view' });
    expect(await repository.getMarkerSpan('first')).toBeNull();
    await repository.setMarkerSpan('first', 2);
    expect(await repository.getMarkerSpan('first')).toBe(2);
    expect(await repository.getMarkerSpan('second')).toBeNull();
    expect(await repository.restore()).toBeNull();
    repository.close();
});
