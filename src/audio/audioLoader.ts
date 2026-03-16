/**
 * 加载音频文件并解码为 AudioBuffer（浏览器环境）
 */
export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
}
