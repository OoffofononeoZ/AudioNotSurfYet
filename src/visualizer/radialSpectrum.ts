/** Repeat the complete source array, including zeros and channel seams. */
export function createRadialSpectrumSampler(levels: ArrayLike<number>): (index: number) => number {
    return index => levels.length ? levels[((index % levels.length) + levels.length) % levels.length] ?? 0 : 0;
}
