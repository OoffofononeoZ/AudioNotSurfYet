import { interleave, wavHeader } from '../../src/processing/dsp';

/** Self-authored CC0 phrases/attacks with repeats, gain changes, and a reversed distractor. */
export function exampleSearchWav(): Uint8Array {
    const rate = 44100,
        pcm = new Float32Array(rate * 12);
    for (const [start, gain, reversed] of [
        [0.5, 1, 0],
        [4, 0.45, 0],
        [6, 0.8, 1],
        [8, 0.7, 0],
    ]) {
        const pitches = reversed ? [440, 330, 220] : [220, 330, 440];
        pitches.forEach((frequency, note) => {
            const first = Math.round((start! + note * 0.4) * rate);
            for (let i = 0; i < rate * 0.32; i++) {
                const time = i / rate,
                    envelope = Math.min(1, time / 0.004) * Math.exp(-time * 5);
                pcm[first + i] =
                    gain! *
                    0.2 *
                    envelope *
                    (Math.sin(2 * Math.PI * frequency * time) +
                        0.35 * Math.sin(2 * Math.PI * frequency * 2 * time) +
                        0.12 * Math.sin(2 * Math.PI * frequency * 4 * time));
            }
        });
    }
    for (const start of [2.4, 2.52, 10.3, 11.2])
        for (let i = 0; i < 0.16 * rate; i++) {
            const time = i / rate;
            pcm[Math.round(start * rate) + i] =
                0.4 * Math.exp(-time * 35) * Math.sin(2 * Math.PI * (80 * time + 1.2 * (1 - Math.exp(-time * 45))));
        }
    const header = wavHeader(pcm.length),
        audio = interleave(pcm, pcm),
        result = new Uint8Array(header.byteLength + audio.byteLength);
    result.set(new Uint8Array(header));
    result.set(new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength), header.byteLength);
    return result;
}
