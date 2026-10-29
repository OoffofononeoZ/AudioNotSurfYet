import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserAudioFiles } from '../../src/platform/webAudioFiles';
import { DesktopAudioFiles } from '../../src/platform/desktopAudioFiles';
import type { DesktopFileBridge, NativeFileDescriptor, NativeFileReference } from '../../src/platform/fileContracts';

const reference: NativeFileReference = {
    kind: 'file',
    platform: 'electron',
    grantId: 'selected-file',
    name: 'song.wav',
};
const descriptor: NativeFileDescriptor = {
    reference,
    size: 4,
    lastModified: 1234,
    mimeType: 'audio/wav',
    revision: 'revision-1',
    readUrl: 'app://audiosurf/native-files/selected-file',
};
const success = <T>(value: T) => ({ ok: true as const, value });

function bridge() {
    return {
        chooseFiles: vi.fn(),
        releaseInput: vi.fn(),
        chooseAudio: vi.fn(async () => success([reference])),
        describeFile: vi.fn<DesktopFileBridge['describeFile']>(async () => success(descriptor)),
        filePermission: vi.fn(async () => success('granted' as const)),
        chooseResourceDirectory: vi.fn(),
        listDirectory: vi.fn(),
        describeDirectoryFile: vi.fn(),
    } satisfies DesktopFileBridge;
}
afterEach(() => vi.unstubAllGlobals());

describe('dual audio file ports', () => {
    it('leaves browser handle identity and permission calls unchanged', async () => {
        const file = new File(['wave'], 'song.wav', { type: 'audio/wav' });
        const handle = {
            kind: 'file' as const,
            name: file.name,
            getFile: vi.fn(async () => file),
            queryPermission: vi.fn(async () => 'prompt'),
            requestPermission: vi.fn(async () => 'granted'),
        };
        const picker = vi.fn(async () => [handle]);
        vi.stubGlobal('window', { showOpenFilePicker: picker });
        const access = new BrowserAudioFiles();
        expect((await access.choose({ multiple: true }))[0]).toBe(handle);
        expect(await access.read(handle)).toBe(file);
        expect(await access.queryPermission(handle)).toBe('prompt');
        expect(await access.requestPermission(handle)).toBe('granted');
        expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
        expect(access.restoreFromReferenceFirst).toBe(false);
    });

    it('streams a granted desktop file and preserves metadata without a whole-file IPC payload', async () => {
        const host = bridge(),
            fetchFile = vi.fn(async () => new Response('wave'));
        const access = new DesktopAudioFiles(host, fetchFile as typeof fetch);
        expect(await access.choose({ multiple: true })).toEqual([reference]);
        const file = await access.read(reference);
        expect(await file.text()).toBe('wave');
        expect(file.name).toBe('song.wav');
        expect(file.type).toBe('audio/wav');
        expect(file.lastModified).toBe(1234);
        expect(host.describeFile).toHaveBeenCalledTimes(2);
        expect(fetchFile).toHaveBeenCalledWith(descriptor.readUrl, expect.objectContaining({ cache: 'no-store' }));
        expect(access.restoreFromReferenceFirst).toBe(true);
    });

    it('refuses content changing during the read and does not publish an aborted result', async () => {
        const host = bridge();
        host.describeFile
            .mockResolvedValueOnce(success(descriptor))
            .mockResolvedValueOnce(success({ ...descriptor, revision: 'changed' }));
        const access = new DesktopAudioFiles(host, vi.fn(async () => new Response('wave')) as typeof fetch);
        await expect(access.read(reference)).rejects.toMatchObject({ name: 'NotReadableError' });
        const cancelledHost = bridge(),
            cancellation = new AbortController();
        const cancelled = new DesktopAudioFiles(
            cancelledHost,
            vi.fn(async () => {
                cancellation.abort();
                return new Response('wave');
            }) as typeof fetch,
        );
        await expect(cancelled.read(reference, cancellation.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(cancelledHost.describeFile).toHaveBeenCalledTimes(1);
    });

    it('maps native missing and denied outcomes to the shared recovery error names', async () => {
        const host = bridge();
        host.describeFile.mockResolvedValueOnce({
            ok: false,
            error: { code: 'file-missing', message: 'missing' },
        });
        const fetchFile = vi.fn(),
            access = new DesktopAudioFiles(host, fetchFile);
        await expect(access.read(reference)).rejects.toMatchObject({ name: 'NotFoundError' });
        await expect(access.read({ kind: 'file', name: 'foreign handle' })).rejects.toMatchObject({
            name: 'NotAllowedError',
        });
        expect(fetchFile).not.toHaveBeenCalled();
    });
});
