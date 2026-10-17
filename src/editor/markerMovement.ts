import { normalizeEditorSeconds } from './projectCodec';
import { updateRangeEvent } from './rangeAnnotations';
import type { EditorProjectV1 } from './types';

export function moveEditorMarker(project: EditorProjectV1, laneId: string, eventId: string, targetSeconds: number): EditorProjectV1 {
    const lane = project.lanes.find(item => item.id === laneId);
    if (!lane) throw new Error('找不到对应的标记轨道。');
    const time = normalizeEditorSeconds(targetSeconds);
    if (!Number.isFinite(time) || time < 0 || time > project.track.durationSeconds) throw new Error('目标超出歌曲范围，标记保持原位。');
    if (lane.eventKind === 'range') {
        const event = lane.events.find(item => item.id === eventId);
        if (!event) throw new Error('找不到对应的范围标记。');
        return updateRangeEvent(project, laneId, eventId, time, normalizeEditorSeconds(time + event.endSeconds - event.startSeconds));
    }
    const event = lane.events.find(item => item.id === eventId);
    if (!event) throw new Error('找不到对应的点标记。');
    if (lane.events.some(item => item.id !== eventId && item.innerClassId === event.innerClassId && normalizeEditorSeconds(item.atSeconds) === time)) throw new Error('目标已有相同分类的点标记，标记保持原位。');
    return { ...project, lanes: project.lanes.map(item => item.id !== laneId ? item : { ...lane,
        events: lane.events.map(item => item.id === eventId ? { ...item, atSeconds: time } : item).sort((a,b) => a.atSeconds - b.atSeconds || a.id.localeCompare(b.id)),
    }) };
}
