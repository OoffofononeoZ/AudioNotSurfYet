import type { EditorProjectV1 } from './types';

export function removeEditorLane(project: EditorProjectV1, laneId: string): EditorProjectV1 {
    if (!project.lanes.some(lane => lane.id === laneId)) throw new Error('找不到对应的标记轨道。');
    return { ...project, lanes: project.lanes.filter(lane => lane.id !== laneId) };
}
