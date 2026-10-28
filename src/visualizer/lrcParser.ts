import type { LyricCue } from './lyricTypes';

/** English words retain punctuation; Han graphemes are individual particles. */
export function lyricTokens(text: string): string[] {
    const tokens: string[] = [];
    let word = '',
        prefix = '';
    const flush = () => {
        if (word) {
            tokens.push(prefix + word);
            prefix = '';
            word = '';
        }
    };
    const { Segmenter } = Intl as unknown as {
        Segmenter: new (
            locale: undefined,
            options: { granularity: 'grapheme' },
        ) => { segment(text: string): Iterable<{ segment: string }> };
    };
    const segmenter = new Segmenter(undefined, { granularity: 'grapheme' });
    for (const { segment } of segmenter.segment(text)) {
        if (/\s/u.test(segment)) {
            flush();
            continue;
        }
        if (/\p{Script=Han}/u.test(segment)) {
            flush();
            tokens.push(prefix + segment);
            prefix = '';
        } else if (/\p{P}/u.test(segment) && !word) {
            if (tokens.length && !/[“‘「『（(\["']/u.test(segment)) tokens[tokens.length - 1] += segment;
            else prefix += segment;
        } else {
            word += segment;
            if (/[.!?。！？;；:：]/u.test(segment)) flush();
        }
    }
    flush();
    if (prefix) {
        if (tokens.length) tokens[tokens.length - 1] += prefix;
        else tokens.push(prefix);
    }
    return tokens;
}

/** All cue times are song seconds. Positive LRC offset means earlier display. */
export function parseLrc(text: string): LyricCue[] {
    const raw: Array<{ time: number; text: string; order: number }> = [];
    let offset = 0;
    for (const [lineIndex, line] of text
        .replace(/^\uFEFF/u, '')
        .split(/\r?\n/)
        .entries()) {
        if (!line.trim()) continue;
        const meta = /^\[([a-z]+):([^\]]*)\]\s*$/iu.exec(line.trim());
        if (meta) {
            if (meta[1]!.toLowerCase() === 'offset') {
                if (!/^[+-]?\d+$/u.test(meta[2]!.trim())) throw Error('LRC offset 必须为整数毫秒。');
                offset = Number(meta[2]) / 1000;
                if (!Number.isSafeInteger(Number(meta[2]))) throw Error('LRC offset 超出范围。');
            }
            continue;
        }
        const tags = [...line.matchAll(/\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/gu)];
        if (!tags.length || line.slice(0, tags[0]!.index).trim()) throw Error(`LRC 第 ${lineIndex + 1} 行缺少时间戳。`);
        const content = line.replace(/\[\d+:\d{2}(?:\.\d{1,3})?\]/gu, '').trim();
        if (/<\d+:\d/u.test(content)) throw Error('当前仅支持逐句 LRC，不支持增强型逐词时间标记。');
        for (const tag of tags) {
            const time = Number(tag[1]) * 60 + Number(tag[2]) + Number('0.' + (tag[3] ?? '0'));
            if (Number(tag[2]) >= 60 || !Number.isFinite(time)) throw Error('LRC 时间戳无效。');
            raw.push({ time, text: content, order: raw.length });
        }
    }
    if (!raw.some(c => c.text)) throw Error('LRC 中没有带时间戳的歌词。');
    raw.sort((a, b) => a.time - b.time || a.order - b.order);
    const ends = new Array<number>(raw.length);
    let later = raw[raw.length - 1]!.time + 4;
    for (let i = raw.length - 1; i >= 0; i--) {
        if (i < raw.length - 1 && raw[i + 1]!.time > raw[i]!.time) later = raw[i + 1]!.time;
        ends[i] = later;
    }
    let index = 0;
    return raw.map((cue, i) => {
        return {
            index: cue.text ? index++ : -1,
            time: cue.time - offset,
            end: ends[i]! - offset,
            text: cue.text,
            tokens: lyricTokens(cue.text),
        };
    });
}
