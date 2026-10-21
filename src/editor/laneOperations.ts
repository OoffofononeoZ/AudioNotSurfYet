import type { EditorProjectV2 } from './types';

export function removeEditorLane(project: EditorProjectV2, laneId: string): EditorProjectV2 {
    if (!project.lanes.some(lane => lane.id === laneId)) throw new Error('找不到对应的标记轨道。');
    return { ...project, lanes: project.lanes.filter(lane => lane.id !== laneId) };
}
