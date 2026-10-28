import { expect, test } from 'vitest';
import { parseLrc, lyricTokens } from '../../src/visualizer/lrcParser';
import { validateLyricAssets, validateLyricBindings, validateLyricInputs } from '../../src/visualizer/lyricCodec';
import { importLyricFile } from '../../src/visualizer/lyricImport';
import { validateAlgorithmDefinition } from '../../src/visualizer/algorithmCodec';
import { validateComposition, encodeComposition, decodeComposition } from '../../src/visualizer/compositionCodec';
import { resourceHash } from '../../src/visualizer/resourceIdentity';
import { compositionIssues, pruneCompositionResources } from '../../src/visualizer/compositionModel';
import { inspectRealtimeProject } from '../../src/visualizer/realtimeCapabilities';
import { validateDrawPacket } from '../../src/visualizer/drawPacket';
import { lyricAsset, lyricFixture } from '../support/lyric-fixture';

test('LRC preserves millisecond times, offsets, multiple tags, blank boundaries and stable equal-time order', () => {
    const cues = parseLrc(
        '\uFEFF[ar:Artist]\n[offset:+500]\n[00:01.125][00:04.5]Hello world!\n[00:03.00]\n[00:01.125]Again',
    );
    expect(cues.map(c => [c.time, c.text])).toEqual([
        [0.625, 'Hello world!'],
        [0.625, 'Again'],
        [2.5, ''],
        [4, 'Hello world!'],
    ]);
    expect(cues[0]!.end).toBe(2.5);
    expect(cues.at(-1)!.end).toBe(8);
    expect(cues.filter(c => c.text).map(c => c.index)).toEqual([0, 1, 2]);
    expect(lyricTokens("Hello world! 你好，世界！ Can't look away.")).toEqual([
        'Hello',
        'world!',
        '你',
        '好，',
        '世',
        '界！',
        "Can't",
        'look',
        'away.',
    ]);
    expect(lyricTokens("met.You've arrived")).toEqual(['met.', "You've", 'arrived']);
});
test.each(['', 'plain lyrics', '[00:99]bad', '[00:01.000]<00:01.1>word', '[offset:no]\n[00:01]word'])(
    'malformed or unsupported LRC fails explicitly: %s',
    text => {
        expect(() => parseLrc(text)).toThrow();
    },
);
test('assets validate exact bytes and bindings; corrupted replacements and cancellation cannot commit', async () => {
    const asset = lyricAsset();
    expect(validateLyricAssets([asset])![0]).toEqual(asset);
    expect(() => validateLyricAssets([{ ...asset, data: btoa('changed') }])).toThrow();
    expect(() => validateLyricInputs([{ id: 'lyrics' }, { id: 'lyrics' }])).toThrow();
    const b = { lyrics: { kind: 'lyrics', assetId: asset.id, leadSeconds: 2, tailSeconds: 1.5, offsetSeconds: 0.25 } };
    expect(validateLyricBindings(b, [{ id: 'lyrics' }], [asset])).toEqual(b);
    expect(() => validateLyricBindings(b, [{ id: 'lyrics' }], [], true)).toThrow();
    expect(() =>
        validateLyricBindings({ lyrics: { ...b.lyrics, leadSeconds: 0 } }, [{ id: 'lyrics' }], [asset]),
    ).toThrow();
    const task = new AbortController();
    task.abort();
    await expect(importLyricFile(new File(['[00:01]word'], 'test.lrc'), task.signal)).rejects.toBeDefined();
});
test('ABI 5 is timeline-only and authorizes only its declared lyric sampler', () => {
    const { algorithm } = lyricFixture();
    expect(validateAlgorithmDefinition(algorithm)).toEqual(algorithm);
    const a = structuredClone(algorithm);
    a.contract.executionModes = ['timeline', 'realtime'];
    a.hash = resourceHash(a);
    expect(() => validateAlgorithmDefinition(a)).toThrow();
    a.contract.executionModes = ['timeline'];
    a.programs.text!.uniforms.uText!.inputId = 'other';
    a.hash = resourceHash(a);
    expect(() => validateAlgorithmDefinition(a)).toThrow();
    const packet = (page: number) => ({
        passes: [
            {
                program: 'text',
                uniforms: { uText: page },
                mesh: { positions: new Float32Array(0), colors: new Float32Array(0), edges: new Float32Array(0) },
            },
        ],
    });
    expect(validateDrawPacket(packet(0), algorithm)).toBeDefined();
    expect(() => validateDrawPacket(packet(4), algorithm)).toThrow();
});
test('project snapshots embed LRC, gate missing input, preserve old formats and prune removed lyric assets', () => {
    const { project, element } = lyricFixture();
    expect(compositionIssues(project)).toContain('测试歌词：歌词未配置');
    const asset = lyricAsset();
    project.lyricAssets = [asset];
    element.lyricBindings = {
        lyrics: { kind: 'lyrics', assetId: asset.id, leadSeconds: 2, tailSeconds: 1.5, offsetSeconds: 0.25 },
    };
    const p = validateComposition(project);
    expect(decodeComposition(encodeComposition(p).buffer as ArrayBuffer)).toEqual(p);
    expect(compositionIssues(p)).toEqual([]);
    expect(inspectRealtimeProject(p).browser).toBe(false);
    const cleared = pruneCompositionResources({ ...p, elements: [], items: [] });
    expect(cleared.lyricAssets).toEqual([]);
    expect(() => validateComposition({ ...p, lyricAssets: [] })).toThrow();
});
