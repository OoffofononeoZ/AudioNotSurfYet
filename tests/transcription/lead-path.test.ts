import { expect, it } from 'vitest';
import { selectLeadPath } from '../../src/transcription/leadPath';
import { noteCandidate } from './review-fixture';
function prominent(id: string, start: number, end: number, pitch: number) {
    const note = noteCandidate(id, start, end, 'piano', pitch);
    note.strength = 0.95;
    note.acoustics!.salience = 0.9;
    note.acoustics!.chroma = Array.from({ length: 12 }, (_, i) => (i === pitch % 12 ? 1 : 0));
    return note;
}
it('tracks a prominent moving phrase through accompaniment and leaves the silent gap empty', async () => {
    const melody = [prominent('a', 0, 0.4, 60), prominent('b', 0.4, 0.8, 64), prominent('c', 1.2, 1.6, 67)];
    const pad = noteCandidate('pad', 0, 1.6, 'guitar', 48);
    pad.strength = 0.5;
    pad.acoustics!.salience = 0.3;
    const notes = [...melody, pad],
        before = JSON.stringify(notes),
        path = await selectLeadPath(notes, 2, new AbortController().signal);
    expect(path.leadIds).toEqual(['a', 'b', 'c']);
    expect(path.otherIds).toEqual(['pad']);
    expect(JSON.stringify(notes)).toBe(before);
});
it('keeps an equally prominent chord uncertain instead of inventing a lead identity', async () => {
    const notes = [prominent('a', 0, 1, 60), prominent('b', 0, 1, 64)];
    const path = await selectLeadPath(notes, 1, new AbortController().signal);
    expect(path.leadIds).toEqual([]);
    expect(path.otherIds).toEqual(['a', 'b']);
});
it('retains independent repeated notes and rejects silent/weak candidates', async () => {
    const notes = [prominent('a', 0, 0.18, 72), prominent('b', 0.2, 0.38, 72), prominent('c', 0.4, 0.58, 72)];
    const silent = prominent('silent', 0.6, 1, 72);
    silent.acoustics!.rms = 0;
    const path = await selectLeadPath([...notes, silent], 1, new AbortController().signal);
    expect(path.leadIds).toEqual(['a', 'b', 'c']);
    expect(path.otherIds).toEqual(['silent']);
});
it('bounds polyphonic path work without losing any raw candidate and observes cancellation', async () => {
    const notes = Array.from({ length: 20 }, (_, i) => prominent(`n${i}`, 0, 2, 40 + i));
    const path = await selectLeadPath(notes, 2, new AbortController().signal);
    expect(path.prunedFrames).toBeGreaterThan(0);
    expect(new Set([...path.leadIds, ...path.otherIds]).size).toBe(20);
    const abort = new AbortController();
    await expect(selectLeadPath(notes, 10, abort.signal, () => abort.abort())).rejects.toMatchObject({
        code: 'job-cancelled',
    });
});
