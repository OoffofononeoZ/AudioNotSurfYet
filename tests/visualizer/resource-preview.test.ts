import { expect, test, vi } from 'vitest';
import { readResourcePreview } from '../../src/visualizer/resourcePreview';
import type { ResourceDirectoryHandle } from '../../src/visualizer/resourceFiles';

function directory(files: Record<string, string>, error?: Error): ResourceDirectoryHandle {
    return {
        async *entries() {
            for (const name of Object.keys(files)) yield [name, { kind: 'file' }];
            yield ['source', { kind: 'directory' }];
        },
        async getFileHandle(name: string) {
            if (error) throw error;
            if (!(name in files)) throw new DOMException('Missing', 'NotFoundError');
            return { getFile: async () => new File([files[name]!], name) };
        },
    } as unknown as ResourceDirectoryHandle;
}
const signal = () => new AbortController().signal;

test('explicit cover wins, then cover, preview and remaining files use a stable order', async () => {
    const root = directory({ 'z.png': 'z', 'preview.webp': 'preview', 'cover.jpg': 'cover', 'a.jpeg': 'a' });
    const decode = vi.fn(async (_blob: Blob) => {});
    expect(await (await readResourcePreview(root, 'z.png', signal(), decode))?.text()).toBe('z');
    expect(await (await readResourcePreview(root, undefined, signal(), decode))?.text()).toBe('cover');
    const attempts: string[] = [];
    const reject = async (blob: Blob) => {
        attempts.push(await blob.text());
        throw Error('corrupt');
    };
    expect(await readResourcePreview(root, undefined, signal(), reject)).toBeNull();
    expect(attempts).toEqual(['cover', 'preview', 'a', 'z']);
});

test('missing, invalid and absent covers do not block the resource; binary formats retain MIME', async () => {
    const decode = vi.fn(async (_blob: Blob) => {});
    for (const [name, type] of [
        ['COVER.PNG', 'image/png'],
        ['cover.jpeg', 'image/jpeg'],
        ['cover.webp', 'image/webp'],
    ]) {
        const blob = await readResourcePreview(directory({ [name!]: 'bytes' }), 'missing.png', signal(), decode);
        expect(blob?.type).toBe(type);
    }
    expect(await readResourcePreview(directory({}), undefined, signal(), decode)).toBeNull();
    expect(await readResourcePreview(directory({ 'notes.txt': 'text' }), 'missing.png', signal(), decode)).toBeNull();
    expect(decode).toHaveBeenCalledTimes(3);
});

test('permission loss, unsafe paths and cancellation are never treated as missing artwork', async () => {
    const decode = vi.fn(async (_blob: Blob) => {});
    for (const name of ['NotAllowedError', 'SecurityError', 'NotReadableError']) {
        await expect(
            readResourcePreview(
                directory({ 'cover.png': 'data' }, new DOMException('Failed', name)),
                undefined,
                signal(),
                decode,
            ),
        ).rejects.toMatchObject({ name });
    }
    await expect(readResourcePreview(directory({}), '../cover.png', signal(), decode)).rejects.toThrow();
    const task = new AbortController();
    await expect(
        readResourcePreview(directory({ 'cover.png': 'data' }), undefined, task.signal, async () => {
            task.abort();
        }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(decode).not.toHaveBeenCalled();
});
