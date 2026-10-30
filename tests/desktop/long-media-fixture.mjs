import fs from 'node:fs/promises';

export const LONG_SECONDS = 900;
export const LONG_EVENTS = [0.15, 1.5, 450, 898.5];
export const LONG_FLASH_SECONDS = 0.05;

/** Same bounded five-second PCM construction as the existing browser long check. */
export async function createLongWav(file) {
    const rate = 48000;
    const count = rate * LONG_SECONDS;
    const header = Buffer.alloc(44);
    header.write('RIFF');
    header.writeUInt32LE(36 + count * 2, 4);
    header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(rate, 24);
    header.writeUInt32LE(rate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(count * 2, 40);
    const handle = await fs.open(file, 'wx');
    try {
        await handle.write(header);
        for (let start = 0; start < count; start += rate * 5) {
            const bytes = Buffer.alloc(Math.min(rate * 5, count - start) * 2);
            for (let i = 0; i < bytes.length / 2; i++) {
                const position = start + i;
                let sample = 0.02 * Math.sin((2 * Math.PI * 220 * position) / rate);
                for (const event of LONG_EVENTS) {
                    const offset = position - Math.round(event * rate);
                    if (offset >= 0 && offset < rate * LONG_FLASH_SECONDS)
                        sample +=
                            0.8 *
                            (0.5 - 0.5 * Math.cos((2 * Math.PI * offset) / (rate * LONG_FLASH_SECONDS - 1))) *
                            Math.sin((2 * Math.PI * 1200 * position) / rate);
                }
                bytes.writeInt16LE(Math.round(sample * 32767), i * 2);
            }
            await handle.write(bytes);
        }
    } finally {
        await handle.close();
    }
}
