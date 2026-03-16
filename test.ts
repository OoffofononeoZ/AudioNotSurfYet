/**
 * 使用 tsx 在控制台运行：npx tsx test.ts [path/to/audio.mp3]
 * 从 MP3 提取时-频-幅度数据并打印摘要
 */
import fs from "node:fs";
import path from "node:path";
import { AudioContext } from "node-web-audio-api";
import { generateSpectrogram } from "./src/audio/generateSpectrogram";
import { getFrequency } from "./src/utils/frequency";

async function loadAudioBuffer(filePath: string): Promise<AudioBuffer> {
  const buf = fs.readFileSync(filePath);
  const arrayBuffer = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  );
  const ctx = new AudioContext();
  return ctx.decodeAudioData(arrayBuffer);
}

async function main() {
  const audioPath =
    process.argv[2] ||
    path.join(process.cwd(), "test.mp3");

  if (!fs.existsSync(audioPath)) {
    console.error("请提供音频文件路径，或在工作区放置 test.mp3");
    console.error("用法: npx tsx test.ts [path/to/audio.mp3]");
    process.exit(1);
  }

  console.log("加载音频:", audioPath);
  const audioBuffer = await loadAudioBuffer(audioPath);
  const pcm = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  console.log("PCM 长度:", pcm.length, "采样率:", sampleRate);

  const result = generateSpectrogram(pcm, sampleRate);

  console.log("\n--- Spectrogram 摘要 ---");
  console.log("timeBins:", result.timeBins, "freqBins:", result.freqBins);
  console.log("fftSize:", result.fftSize, "hopSize:", result.hopSize);
  console.log("spectrogram[0].length:", result.spectrogram[0]?.length);
  console.log(
    "首帧前 100 个幅度:",
    result.spectrogram[0]?.slice(0, 100).map((v) => v.toFixed(4))
  );

  console.log("\n--- 频率轴示例 (前 100 个 bin) ---");
  for (let bin = 0; bin < 100; bin++) {
    const hz = getFrequency(bin, result.sampleRate, result.fftSize);
    console.log(`bin ${bin} -> ${hz.toFixed(2)} Hz`);
  }

  console.log("\n完成.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
