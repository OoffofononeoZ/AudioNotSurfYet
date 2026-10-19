/** Independent wall-clock tap average with a four-second idle reset. */
export class TapTempoEstimator {
    private times: number[] = [];
    reset(): void {
        this.times = [];
    }
    tap(now: number): { count: number; bpm: number | null } {
        if (!Number.isFinite(now)) throw new Error('无效的点按时间。');
        const last = this.times[this.times.length - 1];
        if (last !== undefined && (now - last > 4000 || now <= last)) this.reset();
        this.times.push(now);
        if (this.times.length > 129) this.times.shift();
        const count = this.times.length;
        if (count < 2) return { count, bpm: null };
        const interval = (this.times[count - 1]! - this.times[0]!) / (count - 1);
        return { count, bpm: Math.round(60000 / interval) };
    }
}
