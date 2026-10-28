import { expect, test } from '@playwright/test';

test('lyric atlas windows, readonly worker input, stale preparation and disposal', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const load = (name: string) => import('/src/visualizer/' + name + '.ts');
        const fixturePath = '/tests/support/lyric-fixture.ts';
        const { lyricFixture, lyricAsset } = await import(fixturePath);
        const { CompositionLyricHost, lyricHostDiagnostics } = await load('lyricHost');
        const { IsolatedAlgorithmRuntime } = await load('isolatedAlgorithmRuntime');
        const { resourceHash } = await load('resourceIdentity');
        const { project, element, algorithm } = lyricFixture();
        const asset = lyricAsset('[00:03.125]Hello world\n[00:05]你好世界\n[00:07]Last');
        project.lyricAssets = [asset];
        element.lyricBindings.lyrics = {
            kind: 'lyrics',
            assetId: asset.id,
            leadSeconds: 2,
            tailSeconds: 1.5,
            offsetSeconds: 0.25,
        };
        const baseline = lyricHostDiagnostics.textures;
        const host = new CompositionLyricHost();
        const runtime = new IsolatedAlgorithmRuntime();
        try {
            const early = await host.prepare(project, [element], 1.374, () => true);
            const active = await host.prepare(project, [element], 3.375, () => true);
            const info = active.get(element.id).lyrics;
            const texture = host.texture(element.id, 'lyrics', 0);
            await host.prepare(project, [element], 3.4, () => true);
            const reuse = host.texture(element.id, 'lyrics', 0) === texture;
            const a = {
                ...algorithm,
                source: 'export function create(){return {prepareFrame(f){let blocked=0;try{f.lyrics.lyrics.cues[0].tokens[0].time=99}catch{blocked=1}return {passes:[],state:[blocked,f.lyrics.lyrics.cues[0].tokens[0].time]}}}}',
            };
            a.hash = resourceHash(a);
            await runtime.initialize([{ id: element.id, algorithm: a }]);
            const packet = await runtime.prepareFrames(
                [
                    {
                        id: element.id,
                        frame: {
                            time: 3.375,
                            width: 320,
                            height: 180,
                            mode: 'timeline',
                            range: null,
                            seed: 0,
                            revision: '0',
                            parameters: {},
                            lyrics: active.get(element.id),
                        },
                    },
                ],
                async () => [],
            );
            let stale = false;
            try {
                await host.prepare(project, [element], 3.375, () => false);
            } catch {
                stale = true;
            }
            const keep = host.texture(element.id, 'lyrics', 0) === texture;
            await host.prepare(project, [], 10, () => true);
            return {
                early: early.get(element.id).lyrics.cues.length,
                time: info.cues[0].tokens[0].time,
                second: info.cues[0].tokens[1].time,
                uv: info.cues[0].tokens[0].uv,
                reuse,
                stale,
                keep,
                state: packet.get(element.id).state,
                released: lyricHostDiagnostics.textures === baseline,
            };
        } finally {
            runtime.dispose();
            host.dispose();
        }
    });
    expect(result.early).toBe(0);
    expect(result.time).toBe(3.375);
    expect(result.second).toBe(4.3125);
    expect(result.uv.every((n: number) => n >= 0 && n <= 1)).toBe(true);
    expect(result).toMatchObject({ reuse: true, stale: true, keep: true, released: true, state: [1, 3.375] });
});
