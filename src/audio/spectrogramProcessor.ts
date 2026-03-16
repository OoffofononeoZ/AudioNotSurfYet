import Meyda from "meyda";

/**
 * 对单帧信号使用 Meyda 提取幅度谱
 * 需在调用前设置 Meyda.bufferSize = frame.length
 */
export function computeSpectrum(frame: Float32Array): number[] {
  Meyda.bufferSize = frame.length;

  const result = Meyda.extract("amplitudeSpectrum", frame as any) as
    | Float32Array
    | number[]
    | { amplitudeSpectrum?: Float32Array | number[] }
    | null;

  if (!result) return [];

  // 兼容两种返回形式：
  // 1. 直接返回 Float32Array / number[]
  if (Array.isArray(result) || result instanceof Float32Array) {
    return Array.from(result);
  }

  // 2. 返回对象 { amplitudeSpectrum }
  if (Array.isArray(result.amplitudeSpectrum) || result.amplitudeSpectrum instanceof Float32Array) {
    return Array.from(result.amplitudeSpectrum);
  }

  return [];
}
