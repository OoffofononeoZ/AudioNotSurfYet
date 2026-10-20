/** Wallpaper Engine owns extraction and temporal response; preserve channel order and strength. */
export function wallpaperAudioValues(input: ArrayLike<number>): number[] {
    if (!input || input.length !== 128) throw Error('Wallpaper Engine 音频输入必须为 128 项。');
    const values = Array.from(input);
    if (values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0))
        throw Error('Wallpaper Engine 音频输入包含无效值。');
    return values;
}
