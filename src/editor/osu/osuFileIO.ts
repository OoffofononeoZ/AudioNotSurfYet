import type { LocalAudioInput } from '../../types/audio';
import type { FileTransferAccess } from '../../platform/transferContracts';
import type { AudioFileAccess } from '../../platform/fileContracts';

export async function pickOsuSource(files: FileTransferAccess, signal?: AbortSignal): Promise<LocalAudioInput | null> {
    const file = await files.open('osu-source', signal);
    return file ? { file } : null;
}
export async function pickOsuAudio(files: AudioFileAccess, signal?: AbortSignal): Promise<LocalAudioInput | null> {
    try {
        const handles = await files.choose({ multiple: false, purpose: 'osu-audio' });
        signal?.throwIfAborted();
        const handle = handles[0];
        return handle ? { handle, file: await files.read(handle, signal) } : null;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return null;
        throw error;
    }
}
