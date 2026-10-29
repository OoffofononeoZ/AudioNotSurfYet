import { BrowserDirectoryExports } from '../../src/platform/webDirectoryExports';
import { expect, test, vi } from 'vitest';
import { createComposition } from '../../src/visualizer/compositionCodec';
import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { createRealtimeStyle } from '../../src/visualizer/realtimeStyle';
import { createWallpaperFiles } from '../../src/visualizer/wallpaperExport';
import { WallpaperDirectoryWriter } from '../../src/visualizer/wallpaperDirectoryWriter';
import { wallpaperAudioValues } from '../../src/visualizer/wallpaperInput';

const track = { contentHash: 'a'.repeat(64), fileName: 'test.wav', durationSeconds: 10, sampleRate: 48000 };
function style(we = true) {
    const p = appendStandaloneElements(createComposition(track), [elementRegistry.create('radial-spectrum', 10, 0)]);
    if (we)
        p.elements[0]!.bindings.find(b => b.parameterId === 'spectrum')!.source = {
            kind: 'analysis',
            featureId: 'wallpaperEngineSpectrum',
            projection: { kind: 'full' },
        };
    return createRealtimeStyle(p, '壁纸 </script>');
}
test('WE adapter validates all 128 channels, preserves strength above one and rejects malformed input', () => {
    const values = Array.from({ length: 128 }, (_, i) => i / 10);
    expect(wallpaperAudioValues(values)).toEqual(values);
    expect(() => wallpaperAudioValues([1])).toThrow();
    expect(() => wallpaperAudioValues([...values.slice(0, 127), NaN])).toThrow();
    expect(() => wallpaperAudioValues([...values.slice(0, 127), -1])).toThrow();
});
test('directory is self contained, escapes serialized data and declares native WE audio processing', () => {
    const files = createWallpaperFiles(style(), '/* bundled runtime */', 'Three.js MIT');
    const index = files.find(f => f.name === 'index.html')!.content,
        data = files.find(f => f.name === 'style-data.js')!.content;
    expect(index).not.toMatch(/https?:\/\//);
    expect(data).not.toContain('</script>');
    expect(JSON.parse(files.at(-1)!.content)).toMatchObject({
        type: 'web',
        file: 'index.html',
        supportsaudioprocessing: true,
    });
    expect(() => createWallpaperFiles(style(false), 'runtime', 'license')).toThrow(/Wallpaper Engine/);
});
function directory(options: { failWrite?: boolean; cleanupFailure?: boolean; abort?: AbortController } = {}) {
    const writes: string[] = [],
        remove = vi.fn(async () => {
            if (options.cleanupFailure) throw Error('denied');
        });
    const child = {
        getFileHandle: async (name: string) => ({
            createWritable: async () => ({
                write: async () => {
                    if (options.failWrite) throw Error('disk full');
                    writes.push(name);
                    options.abort?.abort();
                },
                close: async () => {},
                abort: async () => {},
            }),
        }),
    };
    const parent = {
        name: 'exports',
        getDirectoryHandle: async (_name: string, options?: { create?: boolean }) => {
            if (!options?.create) throw new DOMException('missing', 'NotFoundError');
            return child;
        },
        removeEntry: remove,
    };
    return {
        writer: new WallpaperDirectoryWriter(new BrowserDirectoryExports(async () => parent as never)),
        writes,
        remove,
    };
}
test('writer commits project.json last and leaves existing directories untouched', async () => {
    const d = directory(),
        files = createWallpaperFiles(style(), 'runtime', 'license');
    expect(await d.writer.save(files)).toMatchObject({
        status: 'saved',
        folderName: expect.stringMatching(/^audiosurf-/),
    });
    expect(d.writes.at(-1)).toBe('project.json');
    expect(d.remove).not.toHaveBeenCalled();
});
test('picker cancellation makes no files; write failures and mid-write cancellation clean only their new directory', async () => {
    const cancelled = new WallpaperDirectoryWriter(
        new BrowserDirectoryExports(async () => {
            throw new DOMException('cancel', 'AbortError');
        }),
    );
    expect(await cancelled.save([])).toEqual({ status: 'cancelled' });
    const files = createWallpaperFiles(style(), 'runtime', 'license');
    const failed = directory({ failWrite: true });
    await expect(failed.writer.save(files)).rejects.toThrow('disk full');
    expect(failed.remove).toHaveBeenCalledTimes(1);
    const signal = new AbortController(),
        aborted = directory({ abort: signal });
    expect(await aborted.writer.save(files, signal.signal)).toEqual({ status: 'cancelled' });
    expect(aborted.remove).toHaveBeenCalledTimes(1);
    const residual = directory({ failWrite: true, cleanupFailure: true });
    await expect(residual.writer.save(files)).rejects.toThrow(/exports\/audiosurf-/);
});
