import { expect, test, vi, afterEach } from 'vitest';
import { localFontsAvailable, readLocalFonts, desktopLocalFonts } from '../../src/platform/localFonts';
afterEach(() => vi.unstubAllGlobals());
test('font catalog is explicit, sorted, deduplicated and excludes font bytes', async () => {
    const blob = vi.fn(() => {
        throw Error('Font bytes must not be read');
    });
    const query = vi.fn(async () => [
        { family: 'Z', fullName: 'Zed', postscriptName: 'Zed', blob },
        { family: 'A', fullName: 'Alpha', postscriptName: 'Alpha', blob },
        { family: 'A', fullName: 'Alpha', postscriptName: 'Alpha', blob },
    ]);
    vi.stubGlobal('queryLocalFonts', query);
    expect(localFontsAvailable()).toBe(true);
    expect(query).not.toHaveBeenCalled();
    const result = await readLocalFonts(new AbortController().signal);
    expect(result.map(f => f.fullName)).toEqual(['Alpha', 'Zed']);
    expect(Object.keys(result[0]!)).toEqual(['family', 'fullName', 'postscriptName']);
    expect(blob).not.toHaveBeenCalled();
});
test('font denial and cancellation are explicit and do not return stale lists', async () => {
    vi.stubGlobal('queryLocalFonts', async () => {
        throw new DOMException('denied', 'NotAllowedError');
    });
    await expect(readLocalFonts(new AbortController().signal)).rejects.toThrow('未获准');
    let finish!: (value: []) => void;
    vi.stubGlobal('queryLocalFonts', () => new Promise<[]>(resolve => (finish = resolve)));
    const task = new AbortController(),
        pending = readLocalFonts(task.signal);
    task.abort();
    finish([]);
    await expect(pending).rejects.toBeDefined();
    vi.stubGlobal('queryLocalFonts', undefined);
    expect(localFontsAvailable()).toBe(false);
    await expect(readLocalFonts(new AbortController().signal)).rejects.toThrow('不支持');
});

test('desktop enumeration waits for explicit native grant and stops on refusal', async () => {
    const query = vi.fn(async () => [{ family: 'A', fullName: 'Alpha', postscriptName: 'Alpha' }]);
    vi.stubGlobal('queryLocalFonts', query);
    const denied = desktopLocalFonts({ requestAccess: async () => ({ ok: true, value: false }) });
    await expect(denied.read(new AbortController().signal)).rejects.toThrow('未获准');
    expect(query).not.toHaveBeenCalled();
    const allowed = desktopLocalFonts({ requestAccess: async () => ({ ok: true, value: true }) });
    expect(await allowed.read(new AbortController().signal)).toHaveLength(1);
    expect(query).toHaveBeenCalledOnce();
});
