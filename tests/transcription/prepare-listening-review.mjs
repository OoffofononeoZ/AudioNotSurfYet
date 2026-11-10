import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { hashFile } from '../../scripts/lib/desktop-native-runtime.mjs';
const execute = promisify(execFile),
    value = flag => process.argv[process.argv.indexOf(flag) + 1];
for (const flag of ['--product', '--timing', '--paired', '--audio', '--ffmpeg'])
    if (!process.argv.includes(flag)) throw Error(`Missing ${flag}`);
const directory = path.resolve(value('--product'), 'listening-review'),
    relative = path.relative(await fs.realpath(process.cwd()), directory);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw Error('Write review only within workspace.');
await fs.mkdir(directory, { recursive: true });
const product = JSON.parse(await fs.readFile(path.resolve(value('--product'), 'report.json'), 'utf8')),
    timing = JSON.parse(await fs.readFile(value('--timing'), 'utf8')),
    paired = JSON.parse(await fs.readFile(value('--paired'), 'utf8')),
    summarize = part => {
        const anchors = part.matches.map(m => m.expected.startSeconds),
            nearby = part.extra.filter(e =>
                anchors.some(t => Math.abs(e.startSeconds - t) <= part.associationSeconds),
            ).length;
        return {
            observations: part.observedCount,
            timingMatched: part.matchedCount,
            classificationErrors: part.classificationErrors,
            nearbyExtra: nearby,
            otherExtra: part.extraCount - nearby,
            wrongOrUnassociated: part.extraCount - nearby + part.classificationErrors,
            method: 'Same existing 120ms one-to-one association; extra observations near an already matched target are duplicate candidates. Other extras plus wrong classes are mislabels. Controlled self-authored fixture only.',
        };
    };
if (product.sourceHash !== timing.sourceHash || (await hashFile(value('--audio'))) !== product.sourceHash)
    throw Error('Product, manual timing and source audio must refer to the same song.');
await fs.writeFile(
    path.join(directory, 'paired-quality.json'),
    JSON.stringify(
        {
            baseline: summarize(paired.baseline),
            current: summarize(paired.current),
            caveat: 'Separate class errors increased 0→2; do not hide this with combined counts. Same fixture re-derived after diagnosis is not an independent holdout.',
        },
        null,
        2,
    ),
    'utf8',
);
const compiled = path.join(directory, `fixture-${randomUUID()}.mjs`);
await build({
    stdin: {
        contents:
            "export {instrumentClip,knownNotes} from './tests/transcription/qualityFixtures.ts'; export {wavHeader,interleave} from './src/processing/dsp.ts'; export {createInitialEditorProject,validateEditorProjectV2} from './src/editor/projectCodec.ts';",
        resolveDir: process.cwd(),
        loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: compiled,
});
const api = await import(pathToFileURL(compiled)),
    pcm = api.instrumentClip(),
    header = api.wavHeader(pcm.length),
    audio = api.interleave(pcm, pcm),
    wav = Buffer.concat([header, audio]),
    sha = bytes => createHash('sha256').update(bytes).digest('hex');
await fs.writeFile(path.join(directory, 'cc0-instruments.wav'), wav);
const project = api.createInitialEditorProject({
    track: { contentHash: sha(wav), fileName: 'cc0-instruments.wav', durationSeconds: 14, sampleRate: 44100 },
});
for (const instrument of ['piano', 'guitar'])
    project.lanes.push({
        id: `truth-${instrument}`,
        name: `已知示例 ${instrument}`,
        eventKind: 'range',
        innerClasses: [{ id: `truth-class-${instrument}`, label: instrument }],
        events: api.knownNotes
            .filter(n => n.instrument === instrument)
            .map((n, i) => ({
                id: `truth-${instrument}-${i}`,
                innerClassId: `truth-class-${instrument}`,
                startSeconds: n.startSeconds,
                endSeconds: n.endSeconds,
            })),
    });
for (const version of ['baseline', 'current']) {
    const observed = [...paired[version].matches.map(m => m.observed), ...paired[version].extra].sort(
            (a, b) => a.startSeconds - b.startSeconds,
        ),
        classes = new Map(),
        events = [];
    for (let i = 0; i < observed.length; i++) {
        const event = observed[i];
        let suffix = 0,
            id = `${version}-${event.category}`;
        while (events.some(e => e.innerClassId === id && Math.abs(e.atSeconds - event.startSeconds) < 1e-6))
            id = `${version}-${event.category}-${++suffix}`;
        classes.set(id, `${event.category}${suffix ? ' · 同刻重复' : ''}`);
        events.push({ id: `${version}-${i}`, innerClassId: id, atSeconds: event.startSeconds });
    }
    project.lanes.push({
        id: version,
        name: `${version === 'baseline' ? '旧版候选' : '新版默认音色'}（${observed.length}）`,
        eventKind: 'point',
        innerClasses: [...classes].map(([id, label]) => ({ id, label })),
        events,
    });
}
await fs.writeFile(
    path.join(directory, 'cc0-before-after.audiosurf-editor.json'),
    JSON.stringify(api.validateEditorProjectV2(project), null, 2),
    'utf8',
);
const clips = [
    ['normal', 46, 8, '普通节奏'],
    ['incomplete-and-misses', 86, 5, '87秒附近的未完成区间与漏标'],
    ['dense', 172, 5, '快速连击/漏标'],
    ['mid-first', 144, 4, '第一处 mid'],
    ['mid-second', 272, 4, '第二处 mid'],
    ['ending', 299, 6, '漏标与 end 单例'],
];
for (const [name, start, duration] of clips)
    await execute(value('--ffmpeg'), [
        '-hide_banner',
        '-loglevel',
        'error',
        '-n',
        '-ss',
        String(start),
        '-i',
        value('--audio'),
        '-t',
        String(duration),
        '-acodec',
        'pcm_f32le',
        '-ar',
        '44100',
        path.join(directory, `${name}.wav`),
    ]);
const defaultTiming = timing.presets.conservative.timing.raw,
    before = summarize(paired.baseline),
    after = summarize(paired.current);
const text = `# 自动标记试听复核\n\nBlack Hole 原曲与人工轨未改。上级目录的 black-hole-default-review*.audiosurf-editor.json 保留人工轨，并追加本轮默认鼓标记；请配合原 MP3 导入 Editor 查看。\n\n本次完整缓存鼓分析约 ${Math.round(product.elapsedMs / 1000)} 秒；默认时间正例 ${defaultTiming.matched}/${defaultTiming.referenceCount}（±55.6ms），仍有 ${timing.incomplete.length} 个未完成子区间。未复核音色不是误检；此处没有声称 95% 正确率。\n\n| 短片 | 原曲秒数 | 关注点 |\n| --- | --- | --- |\n${clips.map(([name, start, duration, label]) => `| [${name}.wav](${name}.wav) | ${start}–${start + duration} | ${label} |`).join('\n')}\n\n受控钢琴/吉他对照：用 cc0-instruments.wav 和 cc0-before-after.audiosurf-editor.json 查看已知范围、旧版与新版起音。相同 120ms 关联下，近时额外候选 ${before.nearbyExtra}→${after.nearbyExtra}，其他额外候选 ${before.otherExtra}→${after.otherExtra}；分类错误另由 ${before.classificationErrors}→${after.classificationErrors}，仍需复核。此样例是自编 CC0，不能代表真实演奏准确率。\n\n真实 mid 的原曲默认门限未找回另一个实例；已有 FT drums 的同版 DSP 对照能双向找回，起点接近但终点仍有差异。实际来源查询以对应产品 report.json 的 rangeExamples 为准，其他匹配未复核。\n`;
await fs.writeFile(path.join(directory, 'README.md'), text, 'utf8');
console.log(
    JSON.stringify({
        directory,
        paired: { baseline: summarize(paired.baseline), current: summarize(paired.current) },
        clips: clips.length,
    }),
);
