/** osu! TapButton's warm-up/averaging policy; four-second idle reset also permits 20 BPM. */
export class TapTempoEstimator {
    private times: number[] = [];
    reset(): void { this.times = []; }
    tap(now: number): { count: number; bpm: number | null } {
        if (!Number.isFinite(now)) throw new Error('无效的点按时间。');
        const last = this.times[this.times.length - 1];
        if (last !== undefined && (now - last > 4000 || now <= last)) this.reset();
        this.times.push(now);
        if (this.times.length > 132) this.times.shift();
        const count = this.times.length;
        if (count < 8) return { count, bpm: null };
        const interval = (this.times[count - 1]! - this.times[4]!) / (count - 5);
        return { count, bpm: Math.round(60000 / interval) };
    }
}
