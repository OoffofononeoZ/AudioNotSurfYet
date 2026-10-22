import type { MediaBinding } from './mediaTypes';
export function mediaSelection(binding: Exclude<MediaBinding, { kind: 'none' }>, time: number) {
    const count = binding.assetIds.length,
        t = Math.max(0, time),
        step = Math.floor(t / binding.intervalSeconds);
    const current = step % count,
        next = (current + 1) % count,
        phase = t % binding.intervalSeconds;
    const mix =
        count > 1 && binding.crossfadeSeconds > 0
            ? Math.max(
                  0,
                  Math.min(1, (phase - binding.intervalSeconds + binding.crossfadeSeconds) / binding.crossfadeSeconds),
              )
            : 0;
    return { current, next, mix };
}
export function videoTime(time: number, duration: number) {
    if (!Number.isFinite(duration) || duration <= 0) throw Error('视频时长无效。');
    return ((Math.max(0, time) % duration) + duration) % duration;
}
