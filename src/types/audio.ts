export interface SpectrogramData {
    spectrogram: number[][]
    sampleRate: number
    fftSize: number
    hopSize: number
    timeBins: number
    freqBins: number
  }