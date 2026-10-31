import type { LyricFont } from './lyricTypes';
import { FrameSupersededError } from './framePreparation';
let sequence = 0;
export class LyricFonts {
    private entries = new Map<string, { face: FontFace; ready: Promise<FontFace>; family: string }>();
    private disposed = false;
    async load(font: LyricFont): Promise<string> {
        const key = font.postscriptName;
        let entry = this.entries.get(key);
        if (!entry) {
            const family = 'lyric-local-' + sequence++;
            const face = new FontFace(family, 'local(' + JSON.stringify(font.postscriptName) + ')');
            entry = { face, family, ready: face.load() };
            this.entries.set(key, entry);
        }
        try {
            await entry.ready;
        } catch {
            if (this.entries.get(key) === entry) this.entries.delete(key);
            throw Error('本机字体“' + font.fullName + '”不可用，请重新选择字体。');
        }
        if (this.disposed || this.entries.get(key) !== entry) throw new FrameSupersededError();
        document.fonts.add(entry.face);
        return '64px "' + entry.family + '", "Microsoft YaHei", sans-serif';
    }
    retain(keys: Set<string>) {
        for (const [key, entry] of this.entries)
            if (!keys.has(key)) {
                document.fonts.delete(entry.face);
                this.entries.delete(key);
            }
    }
    dispose() {
        this.disposed = true;
        this.retain(new Set());
    }
}
