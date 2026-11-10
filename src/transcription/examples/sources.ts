import type { DecodedAudioCopyPort } from '../../analysis/pcm';
import type { EditorSessionSnapshot } from '../../editor/types';
import type { EditorSeparationSnapshot } from '../../processing/editorSeparationService';
import type { TranscriptionBundle } from '../workerProtocol';
import { ACOUSTIC_CONFIG_HASH } from '../acousticIndex';
import { exampleHash } from './types';
import type { ExampleSource } from './types';

export function availableExampleSources(
    editor: EditorSessionSnapshot,
    decoded: DecodedAudioCopyPort,
    separation: EditorSeparationSnapshot,
    bundle: TranscriptionBundle | null,
): ExampleSource[] {
    const project = editor.project,
        descriptor = decoded.getDecodedAudioDescriptor();
    if (
        editor.state !== 'ready' ||
        !project ||
        !descriptor ||
        descriptor.trackId !== editor.activeTrackId ||
        ![1, 2].includes(descriptor.channelCount) ||
        Math.abs(descriptor.durationSeconds - project.track.durationSeconds) > 1e-6
    )
        return [];
    const original: ExampleSource = {
        key: exampleHash([
            project.track.contentHash,
            'original',
            descriptor.sampleRate,
            descriptor.length,
            descriptor.channelCount,
            ACOUSTIC_CONFIG_HASH,
        ]),
        songHash: project.track.contentHash,
        trackId: descriptor.trackId,
        kind: 'original',
        label: '原曲',
        role: 'original',
        frames: descriptor.length,
        sampleRate: descriptor.sampleRate,
        channels: descriptor.channelCount,
        descriptor: { ...descriptor },
    };
    const sources = [original],
        ft = separation.result;
    if (
        ft &&
        ft.source.descriptor.trackId === descriptor.trackId &&
        !['restoring', 'running', 'cancelling', 'clearing'].includes(separation.status)
    ) {
        for (const stem of ft.stems)
            sources.push({
                key: exampleHash([
                    project.track.contentHash,
                    'ft',
                    ft.source.hash,
                    ft.source.directory,
                    stem.role,
                    ACOUSTIC_CONFIG_HASH,
                ]),
                songHash: project.track.contentHash,
                trackId: descriptor.trackId,
                kind: 'ft',
                label: `FT ${stem.role}`,
                role: stem.role,
                frames: stem.frames,
                sampleRate: stem.sampleRate,
                channels: 2,
                directory: ft.source.directory,
                resultId: ft.source.directory,
                left: stem.left,
                right: stem.right,
            });
        if (
            bundle?.auxiliary &&
            bundle.result.identity.ftResultId === ft.source.directory &&
            bundle.result.identity.contentHash === project.track.contentHash
        )
            for (const stem of bundle.auxiliary.stems)
                sources.push({
                    key: exampleHash([
                        project.track.contentHash,
                        'auxiliary',
                        ft.source.hash,
                        bundle.result.id,
                        stem.role,
                        ACOUSTIC_CONFIG_HASH,
                    ]),
                    songHash: project.track.contentHash,
                    trackId: descriptor.trackId,
                    kind: 'auxiliary',
                    label: stem.role === 'piano' ? '已有辅助钢琴' : '已有辅助吉他',
                    role: stem.role,
                    frames: stem.frames,
                    sampleRate: stem.sampleRate,
                    channels: 2,
                    directory: bundle.auxiliary.directory,
                    resultId: bundle.result.id,
                    left: stem.left,
                    right: stem.right,
                });
    }
    return sources;
}
