import type { EditorProjectV2 } from './types';
import type { EditorBeatSnapSetting } from './beatSnap';
import { normalizeEditorSeconds } from './projectCodec';

export function assertMarkerCellCount(value: number, minimum = 0): void {
    if (!Number.isSafeInteger(value) || value < minimum) throw Error(`格数必须为不小于 ${minimum} 的安全整数。`);
}

interface GridRun {
    start: number;
    end: number;
    steps: number;
    segments: GridSegment[];
}
interface GridSegment {
    start: number;
    end: number;
    origin: number;
    step: number;
    first: number;
    interior: number;
    offset: number;
    run: GridRun;
}

/** Virtual grid indices avoid allocating a whole song's ticks or looping once per requested cell. */
export function createMarkerGridOffset(
    project: Pick<EditorProjectV2, 'tempoMap' | 'track'>,
    setting: Readonly<EditorBeatSnapSetting>,
) {
    assertMarkerCellCount(setting.divisor, 1);
    const duration = project.track.durationSeconds;
    const segments: (GridSegment | undefined)[] = [];
    let run: GridRun | undefined;
    for (const [index, tempo] of project.tempoMap.entries()) {
        const start = tempo.startSeconds,
            end = project.tempoMap[index + 1]?.startSeconds ?? duration;
        if (tempo.mode === 'metered' && tempo.bpm === null) {
            segments.push(undefined);
            run = undefined;
            continue;
        }
        if (!run) run = { start, end, steps: 0, segments: [] };
        const step = tempo.mode === 'metered' ? 60 / tempo.bpm! / setting.divisor : end - start;
        const origin = tempo.mode === 'metered' ? tempo.beatOriginSeconds : start;
        let first = Math.floor((start - origin) / step) + 1;
        let last = Math.ceil((end - origin) / step) - 1;
        if (normalizeEditorSeconds(origin + first * step) <= start) first++;
        if (normalizeEditorSeconds(origin + last * step) >= end) last--;
        const interior = tempo.mode === 'single-beat' ? 0 : Math.max(0, last - first + 1);
        const segment = { start, end, origin, step, first, interior, offset: run.steps, run };
        run.steps += interior + 1;
        run.end = end;
        run.segments.push(segment);
        segments.push(segment);
    }
    const at = (segment: GridSegment, index: number) =>
        index === 0
            ? segment.start
            : index === segment.interior + 1
              ? segment.end
              : normalizeEditorSeconds(segment.origin + (segment.first + index - 1) * segment.step);
    function sourceSegment(time: number): GridSegment {
        let low = 0,
            high = project.tempoMap.length - 1;
        while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            if (project.tempoMap[middle]!.startSeconds <= time) low = middle;
            else high = middle - 1;
        }
        const segment = segments[low];
        if (!segment) throw Error('当前位置没有可用网格，请先设置 BPM。');
        return segment;
    }
    return {
        shift(timeSeconds: number, cells: number): number {
            if (!Number.isSafeInteger(cells)) throw Error('移动格数必须为安全整数。');
            if (!Number.isFinite(timeSeconds) || timeSeconds < 0 || timeSeconds > duration)
                throw Error('标记位置超出歌曲范围。');
            if (!cells) return timeSeconds;
            const segment = sourceSegment(timeSeconds),
                run = segment.run;
            const candidates = [0, segment.interior + 1];
            if (segment.interior)
                candidates.push(
                    Math.max(
                        1,
                        Math.min(
                            segment.interior,
                            Math.round((timeSeconds - segment.origin) / segment.step) - segment.first + 1,
                        ),
                    ),
                );
            let nearest = candidates[0]!;
            for (const index of candidates) {
                const distance = Math.abs(at(segment, index) - timeSeconds);
                const previous = Math.abs(at(segment, nearest) - timeSeconds);
                if (distance < previous || (Math.abs(distance - previous) < 1e-10 && index > nearest)) nearest = index;
            }
            const target = segment.offset + nearest + cells;
            if (!Number.isSafeInteger(target) || target < 0 || target > run.steps) {
                if ((target < 0 && run.start > 0) || (target > run.steps && run.end < duration))
                    throw Error('位移经过没有可用网格的区间，操作已取消。');
                throw Error('目标位置超出歌曲范围，操作已取消。');
            }
            let low = 0,
                high = run.segments.length - 1;
            while (low < high) {
                const middle = Math.floor((low + high) / 2),
                    entry = run.segments[middle]!;
                if (entry.offset + entry.interior + 1 < target) low = middle + 1;
                else high = middle;
            }
            const destination = run.segments[low]!;
            return at(destination, target - destination.offset);
        },
    };
}
