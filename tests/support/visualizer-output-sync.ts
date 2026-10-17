/** Synthetic local media for checking alignment before/after a first-recording gap. */
export const OUTPUT_SYNC_RATE = 48000;
export const OUTPUT_SYNC_DURATION = 12;
export const OUTPUT_SYNC_EVENTS = [.15, 1.5, 6, 10.5] as const;
export const OUTPUT_SYNC_FLASH_SECONDS = .05;

export function createOutputSyncWav(): Buffer {
    const count = OUTPUT_SYNC_RATE * OUTPUT_SYNC_DURATION;
    const data = Buffer.alloc(44 + count * 2);
    data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
    data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
    data.writeUInt32LE(OUTPUT_SYNC_RATE, 24); data.writeUInt32LE(OUTPUT_SYNC_RATE * 2, 28);
    data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(count * 2, 40);
    const burstCount = Math.round(OUTPUT_SYNC_FLASH_SECONDS * OUTPUT_SYNC_RATE);
    const starts = OUTPUT_SYNC_EVENTS.map(time => Math.round(time * OUTPUT_SYNC_RATE));
    for (let i = 0; i < count; i++) {
        let sample = .02 * Math.sin(2 * Math.PI * 220 * i / OUTPUT_SYNC_RATE);
        for (const start of starts) {
            const offset = i - start;
            if (offset >= 0 && offset < burstCount) {
                const envelope = .5 - .5 * Math.cos(2 * Math.PI * offset / (burstCount - 1));
                sample += .8 * envelope * Math.sin(2 * Math.PI * 1200 * i / OUTPUT_SYNC_RATE);
            }
        }
        data.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
    }
    return data;
}
