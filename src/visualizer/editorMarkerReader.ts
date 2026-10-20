import { finite, keys, record, text } from './projectValidation';
import { elementAlgorithm, elementDescriptor } from './compositionModel';
import type { VisualizerProjectV5 } from './compositionTypes';
import type { MarkerBinding, MarkerPage, MarkerQuery, MarkerReader } from './editorMarkerTypes';
import type { PointEventV1, RangeEventV1 } from '../editor/types';

export const MARKER_PAGE_SIZE = 256;
const start = (event: PointEventV1 | RangeEventV1) => ('atSeconds' in event ? event.atSeconds : event.startSeconds);
const firstIndex = (length: number, before: (index: number) => boolean) => {
    let low = 0,
        high = length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (before(middle)) low = middle + 1;
        else high = middle;
    }
    return low;
};
/** Owns an index for exactly one immutable project revision. No source names or unrelated Editor data leave the host. */
export function createEditorMarkerReader(project: VisualizerProjectV5, isCurrent: () => boolean): MarkerReader {
    const scope = crypto.randomUUID(),
        indexes = new Map<string, { events: Array<PointEventV1 | RangeEventV1>; maxEnds: number[] }>();
    return async (elementId, query: MarkerQuery) => {
        if (!isCurrent()) throw Error('标记查询所属工程已失效。');
        const raw = record(query, '标记查询'),
            inputId = text(raw.inputId, '标记输入 ID');
        const element = project.elements.find(e => e.id === elementId);
        if (!element) throw Error('标记查询元素不存在。');
        const algorithm = elementAlgorithm(project, element),
            descriptor = elementDescriptor(project, element);
        const input = descriptor.markerInputs?.find(i => i.id === inputId);
        if (algorithm.apiVersion !== 2 || !input) throw Error('算法未声明此标记输入。');
        const binding: MarkerBinding | undefined =
            algorithm.contract.timingInput === inputId
                ? element.timing.kind === 'editor-range'
                    ? { kind: 'single', laneId: element.timing.laneId, eventId: element.timing.eventId }
                    : { kind: 'unbound' }
                : element.markerBindings?.[inputId];
        if (!binding || binding.kind === 'unbound') throw Error('标记输入未配置。');
        const lane = project.editorSnapshot?.project.lanes.find(l => l.id === binding.laneId);
        if (!lane || lane.eventKind !== input.eventKind || !input.selectionModes.includes(binding.kind))
            throw Error('标记输入引用已失效。');
        const owner = elementId + ':' + inputId;
        let index = indexes.get(owner);
        if (!index) {
            const events = lane.events
                .filter(e =>
                    binding.kind === 'single'
                        ? e.id === binding.eventId
                        : !binding.innerClassIds || binding.innerClassIds.includes(e.innerClassId),
                )
                .map((e): PointEventV1 | RangeEventV1 =>
                    'atSeconds' in e
                        ? { id: e.id, innerClassId: e.innerClassId, atSeconds: e.atSeconds }
                        : {
                              id: e.id,
                              innerClassId: e.innerClassId,
                              startSeconds: e.startSeconds,
                              endSeconds: e.endSeconds,
                          },
                )
                .sort((a, b) => start(a) - start(b) || a.id.localeCompare(b.id));
            let maxEnd = 0;
            const maxEnds = events.map(e => {
                maxEnd = Math.max(maxEnd, 'atSeconds' in e ? e.atSeconds : e.endSeconds);
                return maxEnd;
            });
            index = { events, maxEnds };
            indexes.set(owner, index);
        }
        const { events, maxEnds } = index;
        let page: MarkerPage;
        if (binding.kind === 'single') {
            keys(raw, ['inputId']);
            if (events.length !== 1) throw Error('所选标记已失效。');
            page = { eventKind: input.eventKind, events: structuredClone(events), nextCursor: null };
        } else {
            keys(raw, ['inputId', 'startSeconds', 'endSeconds'], ['cursor']);
            const from = finite(raw.startSeconds, '查询起点'),
                to = finite(raw.endSeconds, '查询终点');
            if (from < 0 || to <= from || to > project.track.durationSeconds) throw Error('标记查询时间窗口越界。');
            const lower = firstIndex(events.length, i =>
                input.eventKind === 'point' ? start(events[i]!) < from : maxEnds[i]! <= from,
            );
            const upper = firstIndex(events.length, i => start(events[i]!) < to);
            let offset = lower;
            if (raw.cursor !== undefined) {
                let cursor: unknown;
                try {
                    cursor = JSON.parse(atob(text(raw.cursor, '标记游标')));
                } catch {
                    throw Error('标记查询游标无效。');
                }
                if (
                    !Array.isArray(cursor) ||
                    cursor.length !== 5 ||
                    cursor[0] !== scope ||
                    cursor[1] !== owner ||
                    cursor[2] !== from ||
                    cursor[3] !== to ||
                    !Number.isSafeInteger(cursor[4]) ||
                    cursor[4] < lower ||
                    cursor[4] > upper
                )
                    throw Error('标记查询游标不属于当前输入与窗口。');
                offset = cursor[4];
            }
            const selected: Array<PointEventV1 | RangeEventV1> = [];
            let next: number | null = null;
            for (let i = offset; i < upper; i++) {
                const event = events[i]!;
                if (!('atSeconds' in event) && event.endSeconds <= from) continue;
                if (selected.length === MARKER_PAGE_SIZE) {
                    next = i;
                    break;
                }
                selected.push(event);
            }
            page = {
                eventKind: input.eventKind,
                events: structuredClone(selected),
                nextCursor: next !== null ? btoa(JSON.stringify([scope, owner, from, to, next])) : null,
            };
        }
        await Promise.resolve();
        if (!isCurrent()) throw Error('标记查询所属工程已失效。');
        return page;
    };
}
