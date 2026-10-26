import type { EditorProjectV2 } from './types';
import type { EditorBeatSnapSetting } from './beatSnap';
import { assertMarkerCellCount, createMarkerGridOffset } from './markerGridOffset';
import { validateEditorProjectV2 } from './projectCodec';

/** Move every category together, validating the complete candidate before publishing it. */
export function moveMarkerLane(
    project: EditorProjectV2,
    laneId: string,
    cells: number,
    setting: Readonly<EditorBeatSnapSetting>,
) {
    assertMarkerCellCount(Math.abs(cells), 1);
    const source = project.lanes.find(lane => lane.id === laneId);
    if (!source) throw Error('找不到所选轨道。');
    if (!source.events.length) throw Error('所选轨道没有可移动的标记。');
    const grid = createMarkerGridOffset(project, setting);
    const lane =
        source.eventKind === 'point'
            ? {
                  ...source,
                  events: source.events
                      .map(event => ({ ...event, atSeconds: grid.shift(event.atSeconds, cells) }))
                      .sort((a, b) => a.atSeconds - b.atSeconds || a.id.localeCompare(b.id)),
              }
            : {
                  ...source,
                  events: source.events
                      .map(event => {
                          const startSeconds = grid.shift(event.startSeconds, cells);
                          const endSeconds = grid.shift(event.endSeconds, cells);
                          if (endSeconds <= startSeconds || endSeconds < grid.shift(startSeconds, 1))
                              throw Error('移动后范围不足一格，整轨操作已取消。');
                          return { ...event, startSeconds, endSeconds };
                      })
                      .sort(
                          (a, b) =>
                              a.startSeconds - b.startSeconds ||
                              a.endSeconds - b.endSeconds ||
                              a.id.localeCompare(b.id),
                      ),
              };
    const candidate = { ...project, lanes: project.lanes.map(entry => (entry.id === laneId ? lane : entry)) };
    try {
        validateEditorProjectV2(candidate);
    } catch {
        throw Error('移动后存在重复点或范围重叠，整轨操作已取消。');
    }
    return { project: candidate, eventCount: lane.events.length };
}
