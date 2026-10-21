import { afterEach, describe, expect, test, vi } from 'vitest';
import { NativeEditorFileGateway, editorProjectFileName } from '../../src/editor/fileIO';
import { JSON_V2_CODEC } from '../../src/editor/projectCodec';
import { NativeVisualizerFileGateway } from '../../src/visualizer/fileIO';
import { compositionFileFormat } from '../../src/visualizer/compositionCodec';

afterEach(() => vi.unstubAllGlobals());

describe.each([
    { name: 'Editor', gateway: new NativeEditorFileGateway(), codec: JSON_V2_CODEC },
    { name: 'Visualizer', gateway: new NativeVisualizerFileGateway(), codec: compositionFileFormat },
])('$name native file gateway', ({ gateway, codec }) => {
    test('uses a valid JSON picker filter while preserving compound filenames and exact bytes', async () => {
        const bytes = new Uint8Array([0, 1, 2, 3]);
        const name = `song${codec.extension}`;
        const write = vi.fn(),
            close = vi.fn();
        const showOpenFilePicker = vi.fn(async () => [
            {
                getFile: async () => ({ name, arrayBuffer: async () => bytes.buffer }),
            },
        ]);
        const showSaveFilePicker = vi.fn(async () => ({ createWritable: async () => ({ write, close }) }));
        vi.stubGlobal('window', { showOpenFilePicker, showSaveFilePicker });
        expect(await gateway.open(codec as typeof JSON_V2_CODEC)).toEqual({ name, bytes: bytes.buffer });
        expect(await gateway.save(codec as typeof JSON_V2_CODEC, name, bytes.subarray(1, 3))).toBe('saved');
        for (const picker of [showOpenFilePicker, showSaveFilePicker]) {
            expect(picker).toHaveBeenCalledWith(
                expect.objectContaining({
                    types: [expect.objectContaining({ accept: { 'application/json': ['.json'] } })],
                }),
            );
        }
        expect(showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: name }));
        expect(new Uint8Array(write.mock.calls[0]![0])).toEqual(new Uint8Array([1, 2]));
        expect(close).toHaveBeenCalledOnce();
    });

    test('treats picker cancellation as cancellation', async () => {
        const cancel = async () => {
            throw new DOMException('Cancelled', 'AbortError');
        };
        vi.stubGlobal('window', { showOpenFilePicker: cancel, showSaveFilePicker: cancel });
        expect(await gateway.open(codec as typeof JSON_V2_CODEC)).toBeNull();
        expect(await gateway.save(codec as typeof JSON_V2_CODEC, 'song.json', new Uint8Array())).toBe('cancelled');
    });

    test('aborts failed writes and preserves the original error', async () => {
        const failure = new Error('Disk full');
        const abort = vi.fn(),
            close = vi.fn();
        vi.stubGlobal('window', {
            showSaveFilePicker: async () => ({
                createWritable: async () => ({
                    write: async () => {
                        throw failure;
                    },
                    abort,
                    close,
                }),
            }),
        });
        await expect(gateway.save(codec as typeof JSON_V2_CODEC, 'song.json', new Uint8Array())).rejects.toMatchObject({
            code: 'write-failed',
            message: failure.message,
        });
        expect(abort).toHaveBeenCalledWith(failure);
        expect(close).not.toHaveBeenCalled();
    });
});

test('Editor export filenames keep the established extension', () => {
    expect(editorProjectFileName('song.wav', JSON_V2_CODEC)).toBe('song.audiosurf-editor.json');
});
