import type { LocalAudioInput } from '../../types/audio';

async function pick(accept: Record<string, string[]>, description: string): Promise<LocalAudioInput | null> {
    const picker = (
        window as typeof window & {
            showOpenFilePicker?: (options: Record<string, unknown>) => Promise<FileSystemFileHandle[]>;
        }
    ).showOpenFilePicker;
    if (!picker) throw new Error('请选择最新版 Chrome 或 Edge，通过 localhost 或 HTTPS 导入文件。');
    try {
        const handles = await picker({
            multiple: false,
            excludeAcceptAllOption: true,
            types: [{ description, accept }],
        });
        const handle = handles[0];
        return handle ? { handle, file: await handle.getFile() } : null;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return null;
        throw error;
    }
}

export const pickOsuSource = () => pick({ 'application/octet-stream': ['.osu', '.osz'] }, 'osu 谱面');
export const pickOsuAudio = () => pick({ 'audio/*': ['.mp3', '.wav', '.flac', '.ogg', '.m4a'] }, '谱面引用的音频');
