import { osuControlPoints, osuSliderEnd } from './osuTiming';
import { OsuImportError, type OsuBeatmap, type OsuHitObject, type OsuTimingPoint } from './osuTypes';

interface SourceLine {
    text: string;
    line: number;
}
const numeric = (input: string | undefined, line: number, field: string): number => {
    const value = input?.trim();
    if (!value || !Number.isFinite(Number(value))) throw new OsuImportError(`第 ${line} 行：${field} 必须是有限数值。`);
    return Number(value);
};
const integer = (input: string | undefined, line: number, field: string): number => {
    const value = numeric(input, line, field);
    if (!Number.isSafeInteger(value)) throw new OsuImportError(`第 ${line} 行：${field} 必须是整数。`);
    return value;
};

export function parseOsu(input: string): OsuBeatmap {
    const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/);
    if (lines[0]?.trim() !== 'osu file format v14') throw new OsuImportError('暂只支持 osu 文件格式 v14。');
    const sections = new Map<string, SourceLine[]>();
    let section = '';
    for (let i = 1; i < lines.length; i++) {
        const text = lines[i]!.trim();
        if (!text || text.startsWith('//')) continue;
        if (text.startsWith('[') && text.endsWith(']')) {
            section = text.slice(1, -1);
            continue;
        }
        const entries = sections.get(section) ?? [];
        entries.push({ text, line: i + 1 });
        sections.set(section, entries);
    }
    const fields = (name: string) =>
        new Map(
            (sections.get(name) ?? []).map(({ text }) => {
                const i = text.indexOf(':');
                return [text.slice(0, i).trim(), text.slice(i + 1).trim()];
            }),
        );
    const general = fields('General'),
        metadata = fields('Metadata'),
        editor = fields('Editor'),
        difficulty = fields('Difficulty');
    const mode = integer(general.get('Mode') ?? '0', 1, 'Mode');
    if (mode !== 0 && mode !== 1 && mode !== 3) throw new OsuImportError('暂只支持标准、太鼓和 mania 模式。');
    const audioFilename = general.get('AudioFilename')?.replace(/^"|"$/g, '').trim();
    if (!audioFilename) throw new OsuImportError('谱面缺少 AudioFilename。');
    const columns = mode === 3 ? integer(difficulty.get('CircleSize'), 1, 'CircleSize') : 1;
    if (columns < 1 || columns > 32) throw new OsuImportError('mania 键数必须在 1–32 之间。');
    const multiplier = numeric(difficulty.get('SliderMultiplier') ?? '1.4', 1, 'SliderMultiplier');
    if (multiplier <= 0) throw new OsuImportError('SliderMultiplier 必须大于 0。');
    const timingPoints: OsuTimingPoint[] = (sections.get('TimingPoints') ?? []).map(({ text, line }) => {
        const a = text.split(',');
        const inheritedFlag = a.length < 7 ? 1 : integer(a[6], line, 'uninherited');
        if (inheritedFlag !== 0 && inheritedFlag !== 1)
            throw new OsuImportError(`第 ${line} 行：uninherited 必须为 0 或 1。`);
        const uninherited = inheritedFlag === 1;
        const timeMs = numeric(a[0], line, 'time');
        const beatLengthMs = !uninherited && a[1]?.trim() === 'NaN' ? NaN : numeric(a[1], line, 'beatLength');
        const meter = a[2] === undefined || a[2]?.trim() === '0' ? 4 : integer(a[2], line, 'meter');
        if (uninherited && (beatLengthMs <= 0 || meter < 1 || meter > 32))
            throw new OsuImportError(`第 ${line} 行：BPM 时间点或拍号无效。`);
        return { timeMs, beatLengthMs, meter, uninherited, kiai: !!(integer(a[7] ?? '0', line, 'effects') & 1), line };
    });
    const controls = osuControlPoints(timingPoints);
    if (!controls.some(p => p.timing)) throw new OsuImportError('谱面没有 BPM 时间点。');
    const objects: OsuHitObject[] = (sections.get('HitObjects') ?? [])
        .map(({ text, line }) => {
            const a = text.split(','),
                type = integer(a[3], line, 'type'),
                timeMs = numeric(a[2], line, 'time');
            const x = Math.max(0, Math.min(512, numeric(a[0], line, 'x')));
            let kind: OsuHitObject['kind'],
                endTimeMs = timeMs;
            if (type & 1) kind = 'circle';
            else if (type & 2) {
                kind = 'slider';
                const spans = integer(a[6], line, 'slides'),
                    length = numeric(a[7], line, 'length');
                if (spans < 1 || spans > 9000 || length <= 0)
                    throw new OsuImportError(`第 ${line} 行：滑条需要正长度及 1–9000 个行程。`);
                endTimeMs = osuSliderEnd(timeMs, length, spans, multiplier, mode, controls);
            } else if (type & 8) {
                kind = 'spinner';
                endTimeMs = numeric(a[5], line, 'endTime');
            } else if (type & 128) {
                kind = 'hold';
                endTimeMs = numeric(a[5]?.split(':')[0], line, 'endTime');
            } else throw new OsuImportError(`第 ${line} 行：未知物件类型 ${type}。`);
            if (timeMs < 0 || !Number.isFinite(endTimeMs) || (kind !== 'circle' && endTimeMs <= timeMs))
                throw new OsuImportError(`第 ${line} 行：物件时间无效。`);
            return { kind, timeMs, endTimeMs, x, line };
        })
        .sort((a, b) => a.timeMs - b.timeMs || a.line - b.line);
    const breaks = (sections.get('Events') ?? []).flatMap(({ text, line }) => {
        const a = text.split(',');
        return a[0] === '2' || a[0] === 'Break'
            ? [{ startMs: numeric(a[1], line, 'break start'), endMs: numeric(a[2], line, 'break end') }]
            : [];
    });
    const bookmarkText = editor.get('Bookmarks');
    const bookmarksMs = bookmarkText ? bookmarkText.split(',').map(x => numeric(x, 1, 'Bookmarks')) : [];
    const beatDivisor = editor.has('BeatDivisor') ? integer(editor.get('BeatDivisor'), 1, 'BeatDivisor') : null;
    return {
        formatVersion: 14,
        mode,
        title: metadata.get('TitleUnicode') || metadata.get('Title') || '',
        artist: metadata.get('ArtistUnicode') || metadata.get('Artist') || '',
        creator: metadata.get('Creator') || '',
        difficulty: metadata.get('Version') || '未命名难度',
        audioFilename,
        columns,
        beatDivisor,
        timingPoints,
        objects,
        bookmarksMs,
        breaks,
    };
}
