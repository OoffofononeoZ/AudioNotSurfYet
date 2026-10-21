import { unzip } from 'fflate';
import { parseOsu } from './parseOsu';
import { OsuImportError, type OsuBeatmap } from './osuTypes';

export interface OsuArchiveEntry {
    path: string;
    beatmap?: OsuBeatmap;
    error?: string;
}
export interface OsuArchive {
    beatmaps: OsuArchiveEntry[];
    readAudio(path: string, filename: string, signal?: AbortSignal): Promise<{ name: string; bytes: Uint8Array }>;
    release(): void;
}

export function normalizeOsuPath(input: string): string {
    const path = input.replace(/\\/g, '/');
    if (/^(\/|[a-z]:)/i.test(path)) throw new OsuImportError('谱面引用必须是包内相对路径。');
    const parts: string[] = [];
    for (const part of path.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
            if (!parts.length) throw new OsuImportError('谱面引用越出压缩包。');
            parts.pop();
        } else parts.push(part);
    }
    return parts.join('/');
}

function extract(
    bytes: Uint8Array,
    accept: (name: string) => boolean,
    signal?: AbortSignal,
): Promise<Record<string, Uint8Array>> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('导入已取消。', 'AbortError'));
            return;
        }
        let terminate: (() => void) | undefined;
        const abort = () => {
            terminate?.();
            reject(new DOMException('导入已取消。', 'AbortError'));
        };
        signal?.addEventListener('abort', abort, { once: true });
        try {
            terminate = unzip(bytes, { filter: entry => accept(entry.name) }, (error, files) => {
                signal?.removeEventListener('abort', abort);
                if (signal?.aborted) return;
                if (error) reject(new OsuImportError(`读取压缩包失败：${error.message}`));
                else resolve(files);
            });
        } catch (error) {
            signal?.removeEventListener('abort', abort);
            reject(error);
        }
    });
}

export async function openOsuArchive(input: Uint8Array, signal?: AbortSignal): Promise<OsuArchive> {
    let bytes: Uint8Array | null = input;
    const names = new Map<string, string>();
    let pathError: unknown;
    const files = await extract(
        bytes,
        name => {
            try {
                const normalized = normalizeOsuPath(name).toLocaleLowerCase('en-US');
                if (names.has(normalized)) throw new OsuImportError(`压缩包存在重复路径：${name}`);
                names.set(normalized, name);
                return normalized.endsWith('.osu');
            } catch (error) {
                pathError = error;
                return false;
            }
        },
        signal,
    );
    if (pathError) throw pathError;
    const beatmaps = Object.entries(files).map(([path, contents]): OsuArchiveEntry => {
        try {
            return { path, beatmap: parseOsu(new TextDecoder('utf-8', { fatal: true }).decode(contents)) };
        } catch (error) {
            return { path, error: error instanceof Error ? error.message : String(error) };
        }
    });
    if (!beatmaps.length) throw new OsuImportError('压缩包内没有 .osu 谱面。');
    return {
        beatmaps,
        async readAudio(path, filename, audioSignal) {
            if (!bytes) throw new OsuImportError('压缩包已释放，请重新选择。');
            if (/^(\/|[a-z]:)/i.test(filename.replace(/\\/g, '/')))
                throw new OsuImportError('音频必须是包内相对路径。');
            const base = path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
            const target = normalizeOsuPath(`${base ? base + '/' : ''}${filename}`).toLocaleLowerCase('en-US');
            const name = names.get(target);
            if (!name) throw new OsuImportError(`包内找不到音频：${filename}`);
            const audio = await extract(bytes, entry => entry === name, audioSignal);
            const result = audio[name];
            if (!result) throw new OsuImportError(`无法读取音频：${filename}`);
            return { name: filename.replace(/\\/g, '/').split('/').slice(-1)[0]!, bytes: result };
        },
        release() {
            bytes = null;
        },
    };
}
