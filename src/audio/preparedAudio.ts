import type { TrackRecord } from '../types/audio';

export interface PreparedDecodedAudio {
    readonly token: symbol;
    readonly durationSeconds: number;
    readonly sampleRate: number;
    readonly length: number;
    readonly channelCount: number;
}

export interface AudioPreparationPort {
    prepareEncodedAudio(bytes: ArrayBuffer, signal?: AbortSignal): Promise<PreparedDecodedAudio>;
    hasPreparedAudio(token: symbol): boolean;
    commitPreparedAudio(token: symbol, trackId: string): void;
    discardPreparedAudio(token: symbol): void;
}

export interface PreparedLocalAudio {
    readonly token: symbol;
    readonly track: TrackRecord;
    readonly descriptor: Omit<PreparedDecodedAudio, 'token'>;
}
