import type { ShutdownParticipant } from './lifecycleContracts';
import type { AudioSessionService } from '../audio/audioSessionService';
import type { AnalysisCoordinator } from '../analysis/analysisCoordinator';
import type { EditorSessionController } from '../editor/editorSessionController';
import type { VisualizerSessionController } from '../visualizer/visualizerSessionController';
import type { EditorSeparationService } from '../processing/editorSeparationService';
import type { EditorTranscriptionService } from '../transcription/editorTranscriptionService';
import type { SessionRepositoryTasks } from '../persistence/sessionRepositoryTasks';
import type { SessionPersistenceSnapshot, PlaybackSnapshot } from '../types/audio';

export interface RuntimeShutdownPorts {
    audio: Pick<AudioSessionService, 'cancelPendingOperations' | 'flushForShutdown'>;
    analysis: Pick<AnalysisCoordinator, 'hasActiveTasks' | 'cancel'>;
    editor: Pick<
        EditorSessionController,
        'cancelPendingOperations' | 'flushForShutdown' | 'hasPendingWrite' | 'hasUnexportedWork' | 'getSnapshot'
    >;
    visualizer: Pick<
        VisualizerSessionController,
        'cancelPendingOperations' | 'flush' | 'hasPendingWrite' | 'hasUnresolvedExportOutput'
    >;
    transcription: Pick<EditorTranscriptionService, 'getSnapshot' | 'flushEdits' | 'cancel'>;
    separation: Pick<EditorSeparationService, 'getSnapshot' | 'cancel'>;
    repository: Pick<SessionRepositoryTasks, 'busy' | 'flush'>;
    session(): { persistence: SessionPersistenceSnapshot; playback: PlaybackSnapshot };
    audioReady: Promise<unknown>;
    lock(locked: boolean): void;
    dispose(): Promise<void>;
    unmount(): void;
}
export function createRuntimeShutdown(ports: RuntimeShutdownPorts): ShutdownParticipant {
    let prepared = false,
        finalizing = false;
    const busy = (status: string) => ['restoring', 'running', 'cancelling', 'clearing'].includes(status);
    return {
        inspect() {
            if (finalizing) throw Error('运行时已进入退出收尾，请重试关闭。');
            const session = ports.session(),
                transcription = ports.transcription.getSnapshot();
            return {
                unsaved:
                    ports.editor.hasUnexportedWork() ||
                    ports.editor.hasPendingWrite() ||
                    ports.editor.getSnapshot().persistence === 'not-persisted' ||
                    ports.visualizer.hasPendingWrite() ||
                    transcription.persistence === 'saving' ||
                    transcription.persistence === 'not-persisted' ||
                    ['saving', 'not-persisted'].includes(session.persistence.state),
                tasks:
                    ports.analysis.hasActiveTasks() ||
                    busy(ports.separation.getSnapshot().status) ||
                    busy(transcription.status) ||
                    ports.repository.busy ||
                    session.persistence.state === 'restoring' ||
                    ['loading', 'buffering'].includes(session.playback.state),
                output: ports.visualizer.hasUnresolvedExportOutput(),
            };
        },
        async prepare() {
            if (prepared) return;
            ports.lock(true);
            ports.audio.cancelPendingOperations();
            ports.editor.cancelPendingOperations();
            ports.analysis.cancel();
            await ports.visualizer.cancelPendingOperations();
            const editsSaved = await ports.transcription.flushEdits();
            if (!editsSaved) throw Error('自动标记候选修正尚未保存，请重试后再退出。');
            ports.transcription.cancel();
            ports.separation.cancel();
            await ports.audioReady;
            await ports.repository.flush();
            // A failed write retains the live project. Do not dispose owners until all drafts are durable.
            const saved = await Promise.all([
                ports.editor.flushForShutdown(),
                ports.visualizer.flush(),
                ports.audio.flushForShutdown(),
            ]);
            await ports.repository.flush();
            if (saved.some(value => !value)) throw Error('当前草稿或会话尚未保存。请重试保存或导出后再退出。');
            prepared = true;
        },
        async dispose() {
            if (!prepared) throw Error('退出准备尚未完成。');
            finalizing = true;
            await ports.dispose();
            ports.unmount();
        },
        resume() {
            if (finalizing) return;
            prepared = false;
            ports.lock(false);
        },
    };
}
