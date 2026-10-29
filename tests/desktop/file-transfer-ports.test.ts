import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DesktopFileTransfers } from '../../src/platform/desktopFileTransfers';
import { BrowserFileTransfers } from '../../src/platform/webFileTransfers';
import { SAVE_CHUNK_BYTES, type DesktopSaveBridge } from '../../src/platform/transferContracts';
import type { DesktopFileBridge, NativeFileReference } from '../../src/platform/fileContracts';
import { NativeSaves } from '../../electron/files/nativeSaves';
import { nativeResult } from '../../electron/files/nativeErrors';

const base = path.resolve('test-results/desktop-transfers');
let root: string, saves: NativeSaves;
beforeEach(async () => {
    await mkdir(base, { recursive: true });
    root = await mkdtemp(path.join(base, 'transfer-'));
    saves = new NativeSaves();
});
afterEach(async () => {
    vi.unstubAllGlobals();
    await saves.dispose();
    expect(path.dirname(root)).toBe(base);
    expect(path.basename(root)).toMatch(/^transfer-/);
    await rm(root, { recursive: true, force: true });
});
function fileBridge() {
    return {
        chooseAudio: vi.fn(),
        chooseResourceDirectory: vi.fn(),
        describeFile: vi.fn(),
        filePermission: vi.fn(),
        listDirectory: vi.fn(),
        describeDirectoryFile: vi.fn(),
        chooseProject: vi.fn(),
        releaseProject: vi.fn(async () => ({ ok: true as const, value: undefined })),
    } satisfies DesktopFileBridge;
}
function saveBridge(target: string) {
    return {
        beginSave: vi.fn<DesktopSaveBridge['beginSave']>(async (_purpose, _name, size) =>
            nativeResult(() => saves.begin(target, size)),
        ),
        writeSave: vi.fn(async (id, chunk) => nativeResult(() => saves.write(id, chunk))),
        commitSave: vi.fn(async id => nativeResult(() => saves.commit(id))),
        abortSave: vi.fn(async id => nativeResult(() => saves.abort(id))),
    } satisfies DesktopSaveBridge;
}

test('streams a large Blob with acknowledgement backpressure and never reads the whole Blob or sends paths', async () => {
    const target = path.join(root, 'video.webm'),
        bridge = saveBridge(target);
    await writeFile(target, 'old valid video', 'utf8');
    const data = new Uint8Array(SAVE_CHUNK_BYTES * 2 + 17).map((_, index) => index % 251);
    const blob = new Blob([data], { type: 'video/webm' });
    vi.spyOn(blob, 'arrayBuffer').mockRejectedValue(Error('whole-file read forbidden'));
    let inFlight = 0,
        maximum = 0;
    bridge.writeSave.mockImplementation(async (id, chunk) => {
        maximum = Math.max(maximum, ++inFlight);
        expect(await readFile(target, 'utf8')).toBe('old valid video');
        const result = await nativeResult(() => saves.write(id, chunk));
        --inFlight;
        return result;
    });
    const access = new DesktopFileTransfers(fileBridge(), bridge);
    expect(await access.save('video', 'video.webm', blob)).toBe('saved');
    expect(maximum).toBe(1);
    expect(bridge.writeSave.mock.calls.map(([, chunk]) => chunk.byteLength)).toEqual([
        SAVE_CHUNK_BYTES,
        SAVE_CHUNK_BYTES,
        17,
    ]);
    expect(new Uint8Array(await readFile(target))).toEqual(data);
    expect(await readdir(root)).toEqual(['video.webm']);
});

test('cancellation between chunks aborts the native transaction and preserves the original output', async () => {
    const target = path.join(root, 'saved.json'),
        bridge = saveBridge(target),
        task = new AbortController();
    await writeFile(target, 'keep project', 'utf8');
    bridge.writeSave.mockImplementation(async (id, chunk) => {
        const result = await nativeResult(() => saves.write(id, chunk));
        task.abort();
        return result;
    });
    const access = new DesktopFileTransfers(fileBridge(), bridge);
    expect(await access.save('editor-project', 'saved.json', new Uint8Array(SAVE_CHUNK_BYTES + 10), task.signal)).toBe(
        'cancelled',
    );
    expect(bridge.writeSave).toHaveBeenCalledTimes(1);
    expect(bridge.commitSave).not.toHaveBeenCalled();
    expect(await readFile(target, 'utf8')).toBe('keep project');
    expect(await readdir(root)).toEqual(['saved.json']);
});

test('saves the exact Uint8Array view and treats native dialog cancellation without creating output', async () => {
    const target = path.join(root, 'project.json'),
        bridge = saveBridge(target),
        access = new DesktopFileTransfers(fileBridge(), bridge);
    expect(await access.save('editor-project', 'project.json', new Uint8Array([9, 1, 2, 8]).subarray(1, 3))).toBe(
        'saved',
    );
    expect([...(await readFile(target))]).toEqual([1, 2]);
    bridge.beginSave.mockResolvedValueOnce({ ok: true, value: null });
    expect(await access.save('editor-project', 'another.json', new Uint8Array([3]))).toBe('cancelled');
    expect(bridge.writeSave).toHaveBeenCalledTimes(1);
    expect(await readdir(root)).toEqual(['project.json']);
});

test('releases temporary project grants after successful reads and failed reads', async () => {
    const files = fileBridge(),
        bridge = saveBridge(path.join(root, 'unused.json'));
    const reference: NativeFileReference = {
        kind: 'file',
        platform: 'electron',
        grantId: 'temporary',
        name: 'project.json',
    };
    files.chooseProject.mockResolvedValue({ ok: true, value: reference });
    files.describeFile.mockResolvedValue({
        ok: true,
        value: {
            reference,
            size: 2,
            lastModified: 1,
            mimeType: 'application/json',
            revision: 'r1',
            readUrl: 'app://audiosurf/native-files/temporary',
        },
    });
    const access = new DesktopFileTransfers(files, bridge, vi.fn(async () => new Response('{}')) as typeof fetch);
    expect(await (await access.open('editor-project'))?.text()).toBe('{}');
    expect(files.releaseProject).toHaveBeenLastCalledWith(reference.grantId);
    files.describeFile.mockResolvedValueOnce({ ok: false, error: { code: 'file-missing', message: 'missing' } });
    await expect(access.open('editor-project')).rejects.toMatchObject({ name: 'NotFoundError' });
    expect(files.releaseProject).toHaveBeenCalledTimes(2);
});

test('browser cancellation after a write aborts the writable without committing it', async () => {
    const task = new AbortController(),
        abort = vi.fn(),
        close = vi.fn();
    vi.stubGlobal('window', {
        showSaveFilePicker: async () => ({
            createWritable: async () => ({
                write: async () => task.abort(),
                abort,
                close,
            }),
        }),
    });
    expect(await new BrowserFileTransfers().save('video', 'output.webm', new Blob(['video']), task.signal)).toBe(
        'cancelled',
    );
    expect(abort).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
});
