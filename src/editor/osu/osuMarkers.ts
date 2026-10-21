import { normalizeEditorSeconds, validateEditorProjectV2 } from '../projectCodec';
import type { EditorLaneV1, EditorProjectV2, PointLaneV1, RangeLaneV1 } from '../types';
import { osuControlPoints, osuTempoMap } from './osuTiming';
import { OsuImportError, type OsuBeatmap, type OsuImportOptions } from './osuTypes';

export function defaultOsuTempoReplacement(project: EditorProjectV2): boolean {
    return project.tempoMap.length === 1 && project.tempoMap[0]?.mode === 'metered' && project.tempoMap[0].bpm === null;
}

export function applyOsuBeatmap(
    project: EditorProjectV2,
    beatmap: OsuBeatmap,
    options: OsuImportOptions,
    createId: () => string = () => crypto.randomUUID(),
    now = () => new Date(),
): EditorProjectV2 {
    if (!Object.values(options).some(Boolean)) throw new OsuImportError('请选择要导入的内容。');
    const added: EditorLaneV1[] = [];
    const prefix = `osu · ${beatmap.difficulty}`;
    const names = {
        circle: beatmap.mode === 3 ? '短按' : '点击',
        slider: beatmap.mode === 1 ? '连打' : '滑条',
        spinner: '转盘',
        hold: '长按',
    };
    const lanes = new Map<string, PointLaneV1 | RangeLaneV1>();
    if (options.notes)
        for (const object of beatmap.objects) {
            let lane = lanes.get(object.kind);
            if (!lane) {
                const common = {
                    id: createId(),
                    name: `${prefix} · ${names[object.kind]}`,
                    innerClasses: [],
                };
                lane =
                    object.kind === 'circle'
                        ? { ...common, eventKind: 'point', events: [] }
                        : { ...common, eventKind: 'range', events: [] };
                lanes.set(object.kind, lane);
                added.push(lane);
            }
            const label =
                beatmap.mode === 3
                    ? `键 ${Math.min(beatmap.columns - 1, Math.floor((object.x * beatmap.columns) / 512)) + 1}`
                    : names[object.kind];
            let category = lane.innerClasses.find(c => c.label === label);
            if (!category) {
                category = { id: createId(), label };
                lane.innerClasses.push(category);
            }
            if (lane.eventKind === 'point')
                lane.events.push({
                    id: createId(),
                    innerClassId: category.id,
                    atSeconds: normalizeEditorSeconds(object.timeMs / 1000),
                });
            else
                lane.events.push({
                    id: createId(),
                    innerClassId: category.id,
                    startSeconds: normalizeEditorSeconds(object.timeMs / 1000),
                    endSeconds: normalizeEditorSeconds(object.endTimeMs / 1000),
                });
        }
    if (options.bookmarks && beatmap.bookmarksMs.length) {
        const category = createId();
        added.push({
            id: createId(),
            name: `${prefix} · 书签`,
            eventKind: 'point',
            innerClasses: [{ id: category, label: '书签' }],
            events: beatmap.bookmarksMs.map(time => ({
                id: createId(),
                innerClassId: category,
                atSeconds: normalizeEditorSeconds(time / 1000),
            })),
        });
    }
    function rangeLane(label: string, ranges: Array<{ startSeconds: number; endSeconds: number }>) {
        if (!ranges.length) return;
        const category = createId();
        added.push({
            id: createId(),
            name: `${prefix} · ${label}`,
            eventKind: 'range',
            innerClasses: [{ id: category, label }],
            events: ranges.map(range => ({ ...range, id: createId(), innerClassId: category })),
        });
    }
    if (options.breaks)
        rangeLane(
            '休息',
            beatmap.breaks.map(b => ({
                startSeconds: normalizeEditorSeconds(b.startMs / 1000),
                endSeconds: normalizeEditorSeconds(b.endMs / 1000),
            })),
        );
    if (options.kiai) {
        const ranges: Array<{ startSeconds: number; endSeconds: number }> = [];
        let start: number | null = null;
        for (const point of osuControlPoints(beatmap.timingPoints)) {
            const time = Math.max(
                0,
                Math.min(project.track.durationSeconds, normalizeEditorSeconds(point.timeMs / 1000)),
            );
            if (point.kiai && start === null) start = time;
            else if (!point.kiai && start !== null) {
                if (time > start) ranges.push({ startSeconds: start, endSeconds: time });
                start = null;
            }
        }
        if (start !== null && start < project.track.durationSeconds)
            ranges.push({ startSeconds: start, endSeconds: project.track.durationSeconds });
        rangeLane('Kiai', ranges);
    }
    try {
        return validateEditorProjectV2({
            ...project,
            updatedAt: now().toISOString(),
            lanes: [...project.lanes, ...added],
            tempoMap: options.replaceTempo
                ? osuTempoMap(beatmap.timingPoints, project.track.durationSeconds, createId)
                : project.tempoMap,
        });
    } catch (error) {
        throw new OsuImportError(`谱面无法应用：${error instanceof Error ? error.message : String(error)}`);
    }
}
