import { expect, test } from 'vitest';
import { editorViewportForMeasures, editorMeasureSeconds, normalizeEditorViewport, zoomEditorViewportAtX, constrainEditorViewport } from '../../src/editor/timeline';
import { createInitialEditorProject, validateEditorProjectV1 } from '../../src/editor/projectCodec';
import { createPointLane, createPointEvent } from '../../src/editor/pointAnnotations';
import { createRangeLane, createRangeEvent } from '../../src/editor/rangeAnnotations';
import { moveEditorMarker } from '../../src/editor/markerMovement';
import type { EditorProjectV1, TempoSegmentV1 } from '../../src/editor/types';
const tempo: TempoSegmentV1[] = [{ id:'tempo', startSeconds:0, mode:'metered', bpm:120, bpmSource:'user', meter:{ numerator:4, denominator:4 } }];
function project(): EditorProjectV1 {
    const value = createInitialEditorProject({ track:{ contentHash:'c'.repeat(64),fileName:'long.wav',durationSeconds:900 } });
    value.tempoMap = tempo;
    return value;
}
test('15-minute songs show four bars and zoom no closer than one bar without Analyzer zoom limits', () => {
    const viewport = editorViewportForMeasures(900,tempo,4,37);
    expect(viewport).toEqual({ startSeconds:36,endSeconds:44,zoom:112.5 });
    expect(normalizeEditorViewport(viewport,900)).toEqual(viewport);
    expect(zoomEditorViewportAtX(viewport,900,10000,400,800,2)).toEqual({ startSeconds:39,endSeconds:41,zoom:450 });
    expect(constrainEditorViewport({ startSeconds:0,endSeconds:1,zoom:900 },900,tempo)).toEqual({ startSeconds:0,endSeconds:2,zoom:450 });
    const value = project(); value.workspace.viewport = viewport;
    expect(validateEditorProjectV1(value).workspace.viewport).toEqual(viewport);
});
test('window handles short songs, missing BPM and meter-denominator semantics', () => {
    expect(editorViewportForMeasures(1,tempo,4,0)).toEqual({ startSeconds:0,endSeconds:1,zoom:1 });
    expect(editorViewportForMeasures(30,[],4,0)).toEqual({ startSeconds:0,endSeconds:10,zoom:3 });
    const sixEight: TempoSegmentV1[] = [{ ...tempo[0]!, id:'six', mode:'metered', bpm:120, bpmSource:'user', meter:{ numerator:6,denominator:8 } }];
    expect(editorMeasureSeconds(sixEight,0)).toBe(3);
    expect(editorViewportForMeasures(900,sixEight,4,0).endSeconds).toBe(12);
});
test('point movement preserves identity and rejects duplicates and out-of-song targets atomically', () => {
    let value = createPointLane(project()), lane = value.lanes[0]!;
    value = createPointEvent(value,lane.id,lane.innerClasses[0]!.id,1,()=> 'one').project;
    value = createPointEvent(value,lane.id,lane.innerClasses[0]!.id,2,()=> 'two').project;
    const moved = moveEditorMarker(value,lane.id,'one',1.125);
    expect(moved.lanes[0]!.events[0]).toMatchObject({ id:'one',atSeconds:1.125 });
    expect(value.lanes[0]!.events[0]).toMatchObject({ atSeconds:1 });
    expect(() => moveEditorMarker(value,lane.id,'one',2)).toThrow('目标已有');
    expect(() => moveEditorMarker(value,lane.id,'one',901)).toThrow();
});
test('range movement retains length, permits adjacency and rejects overlap without partial changes', () => {
    let value = createRangeLane(project()); const lane = value.lanes[0]!, category = lane.innerClasses[0]!.id;
    value = createRangeEvent(value,lane.id,category,1,2,()=> 'one').project;
    value = createRangeEvent(value,lane.id,category,3,4,()=> 'two').project;
    expect(moveEditorMarker(value,lane.id,'one',2).lanes[0]!.events[0]).toMatchObject({ id:'one',startSeconds:2,endSeconds:3 });
    expect(() => moveEditorMarker(value,lane.id,'one',2.5)).toThrow();
    expect(() => moveEditorMarker(value,lane.id,'one',899.5)).toThrow();
    expect(value.lanes[0]!.events[0]).toMatchObject({ startSeconds:1,endSeconds:2 });
});
