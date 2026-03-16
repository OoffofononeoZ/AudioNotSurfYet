import type { SpectrogramData } from "../types/audio";
import { frameSignal } from "./frameSignal";
import { computeSpectrum } from "./spectrogramProcessor";

const DEFAULT_FFT_SIZE = 1024;
const DEFAULT_HOP_SIZE = 512;

/**
 * 从 PCM 数据生成时-频-幅度 spectrogram
 * spectrogram[time][frequency] = amplitude
 */
export function generateSpectrogram(
  pcm: Float32Array,
  sampleRate: number,
  options?: { fftSize?: number; hopSize?: number }
): SpectrogramData {
  const fftSize = options?.fftSize ?? DEFAULT_FFT_SIZE;
  const hopSize = options?.hopSize ?? DEFAULT_HOP_SIZE;

  const frames = frameSignal(pcm, fftSize, hopSize);
  const spectrogram: number[][] = [];

  for (const frame of frames) {
    const spectrum = computeSpectrum(frame);
    spectrogram.push(spectrum);
  }

  return {
    spectrogram,
    sampleRate,
    fftSize,
    hopSize,
    timeBins: spectrogram.length,
    freqBins: spectrogram[0]?.length ?? 0,
  };
}
