/**
 * 将一维信号按 frameSize 与 hopSize 分帧
 */
export function frameSignal(
  signal: Float32Array,
  frameSize: number,
  hopSize: number
): Float32Array[] {
  const frames: Float32Array[] = [];
  for (let i = 0; i + frameSize <= signal.length; i += hopSize) {
    frames.push(signal.slice(i, i + frameSize));
  }
  return frames;
}
