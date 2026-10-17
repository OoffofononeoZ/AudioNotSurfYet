import { expect, test } from 'vitest';
import { removeEditorLane } from '../../src/editor/laneOperations';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { createPointLane, createPointEvent } from '../../src/editor/pointAnnotations';

test('removes a complete lane atomically, including its classes and events, and permits an empty project', () => {
    const initial = createInitialEditorProject({ track: { contentHash: 'a'.repeat(64), fileName: 'test.wav', durationSeconds: 10 } });
    const withLane = createPointLane(initial);
    const lane = withLane.lanes[0]!;
    const project = createPointEvent(withLane, lane.id, lane.innerClasses[0]!.id, 1).project;
    expect(removeEditorLane(project, lane.id).lanes).toEqual([]);
    expect(project.lanes[0]!.events).toHaveLength(1);
    expect(() => removeEditorLane(project, 'missing')).toThrow('找不到');
});
