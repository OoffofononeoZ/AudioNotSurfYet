import { shallowReactive } from 'vue';

export const PLAYBACK_MODES = ['sequence', 'repeat-one', 'repeat-all', 'shuffle'] as const;
export type PlaybackMode = typeof PLAYBACK_MODES[number];
export const PLAYBACK_MODE_LABELS: Record<PlaybackMode, string> = {
    sequence: '顺序播放', 'repeat-one': '单曲循环', 'repeat-all': '列表循环', shuffle: '随机播放',
};
export const isPlaybackMode = (value: unknown): value is PlaybackMode =>
    PLAYBACK_MODES.includes(value as PlaybackMode);

/** Queue order is independent of the song clock and renderer determinism. */
export class PlaybackPolicy {
    readonly state = shallowReactive({
        preferredMode: 'sequence' as PlaybackMode,
        effectiveMode: 'sequence' as PlaybackMode,
        modeLocked: false,
        exportLocked: false,
    });
    private history: string[] = [];
    private historyIndex = -1;
    private remaining: string[] = [];
    private queueKey = '';

    setPreferredMode(mode: PlaybackMode) {
        if (!isPlaybackMode(mode)) return;
        this.state.preferredMode = mode;
        if (!this.state.modeLocked) this.state.effectiveMode = mode;
    }

    setRouteActive(active: boolean) {
        this.state.modeLocked = active;
        this.state.effectiveMode = active ? 'repeat-one' : this.state.preferredMode;
    }

    selected(id: string) {
        if (this.history[this.historyIndex] === id) return;
        this.history.splice(this.historyIndex + 1);
        this.history.push(id);
        this.historyIndex = this.history.length - 1;
        this.remaining = this.remaining.filter(entry => entry !== id);
    }

    target(ids: readonly string[], current: string | null, delta: -1 | 1): string | null {
        if (!ids.length) return null;
        const index = Math.max(0, ids.indexOf(current ?? ''));
        const mode = this.state.effectiveMode;
        if (mode === 'repeat-one') return current ?? ids[0]!;
        if (mode === 'sequence') return ids[index + delta] ?? null;
        if (mode === 'repeat-all') return ids[(index + delta + ids.length) % ids.length]!;
        const key = ids.join('|');
        if (this.queueKey !== key) {
            this.queueKey = key;
            this.remaining = this.remaining.filter(id => ids.includes(id));
            this.history = this.history.filter(id => ids.includes(id));
            this.historyIndex = this.history.length - 1;
        }
        if (delta < 0) {
            if (this.historyIndex <= 0) return current;
            return this.history[--this.historyIndex]!;
        }
        if (this.historyIndex + 1 < this.history.length) return this.history[++this.historyIndex]!;
        if (!this.remaining.length) this.remaining = ids.filter(id => ids.length === 1 || id !== current);
        const choice = Math.floor(Math.random() * this.remaining.length);
        return this.remaining.splice(choice, 1)[0] ?? current;
    }
}
