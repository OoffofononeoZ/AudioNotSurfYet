import { describe, expect, test, vi } from 'vitest';
import { PlaybackPolicy } from '../../src/audio/playbackPolicy';
describe('queue playback policy', () => {
    test('restores preference after a temporary workspace override', () => {
        const p = new PlaybackPolicy(); p.setPreferredMode('shuffle'); p.setRouteActive(true);
        expect(p.state.effectiveMode).toBe('repeat-one'); p.setRouteActive(false);
        expect(p.state.effectiveMode).toBe('shuffle');
        p.setPreferredMode('repeat-all'); expect(p.target(['a','b'], 'b', 1)).toBe('a');
        p.setPreferredMode('sequence'); expect(p.target(['a','b'], 'b', 1)).toBeNull();
    });
    test('shuffle visits each track then retraces history', () => {
        const random = vi.spyOn(Math, 'random').mockReturnValue(0);
        const p = new PlaybackPolicy(); p.setPreferredMode('shuffle'); p.selected('a');
        const seen = ['a']; let current = 'a';
        for (let i=0;i<2;i++) { current=p.target(['a','b','c'],current,1)!; seen.push(current); p.selected(current); }
        expect(new Set(seen).size).toBe(3);
        expect(p.target(['a','b','c'],current,-1)).toBe(seen[1]);
        random.mockRestore();
    });
});
