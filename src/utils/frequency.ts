/**
 * 根据频率 bin 索引计算对应的真实频率 (Hz)
 */
export function getFrequency(
  bin: number,
  sampleRate: number,
  fftSize: number
): number {
  return (bin * sampleRate) / fftSize;
}
