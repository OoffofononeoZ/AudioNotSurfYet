<template>
    <div id="main-layout">
        <AppSidebar v-if="!presentation" />
        <AppSettingsButton v-if="!presentation" />
        <div class="app-content" :class="{ 'presentation-content': presentation }">
            <router-view />
        </div>
        <MusicBar v-if="!presentation" :progress="0" />
        <AppShutdownOverlay :busy="shutdownBusy" />
    </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onUnmounted, provide, ref, watch, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { realtimeBrowserKey } from '../visualizer/realtimeBrowserSession';
import AppSidebar from '../components/AppSidebar.vue';
import AppSettingsButton from '../components/AppSettingsButton.vue';
import MusicBar from '../components/MusicBar.vue';
import { AudioSessionService, audioSessionServiceKey } from '../audio/audioSessionService';
import { AudioEngine } from '../audio/audioEngine';
import { usePlatformPorts } from '../platform/platformPorts';
import { usePlaybackKeyboard } from '../audio/usePlaybackKeyboard';
import { AnalysisCoordinator, analysisCoordinatorKey } from '../analysis/analysisCoordinator';
import { isFeatureId, type FeatureId } from '../analysis/types';
import { SessionRepository } from '../persistence/sessionRepository';
import { SessionRepositoryTasks } from '../persistence/sessionRepositoryTasks';
import { createRuntimeShutdown } from '../platform/runtimeShutdown';
import AppShutdownOverlay from '../components/platform/AppShutdownOverlay.vue';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import { useConfigstore } from '../stores/configStore';
import { EditorSessionController, editorSessionControllerKey } from '../editor/editorSessionController';
import { EditorDraftRepository } from '../editor/editorDraftRepository';
import { NativeEditorFileGateway } from '../editor/fileIO';
import { VisualizerSessionController, visualizerSessionControllerKey } from '../visualizer/visualizerSessionController';
import { CompositionDraftRepository } from '../visualizer/compositionDraftRepository';
import { NativeVisualizerFileGateway } from '../visualizer/fileIO';
import { NativeVisualizerVideoFileGateway } from '../visualizer/videoFileIO';
import { EditorSeparationService, editorSeparationServiceKey } from '../processing/editorSeparationService';
import { EditorProcessingGate } from '../processing/editorProcessingGate';
import { EditorTranscriptionService, editorTranscriptionServiceKey } from '../transcription/editorTranscriptionService';

const audioSessionStore = useAudioSessionStore();
const layoutRoute = useRoute();
const presentation = computed(() => layoutRoute.meta.presentation === true);
const configStore = useConfigstore();
const previousSidebarWidth = document.documentElement.style.getPropertyValue('--app-sidebar-width');
watchEffect(() => {
    document.documentElement.style.setProperty('--app-sidebar-width', configStore.sidebarCollapsed ? '64px' : '216px');
});
const audioEngine = new AudioEngine();
const shutdownBusy = ref(false);
const platform = usePlatformPorts();
const sessionRepository = new SessionRepositoryTasks(new SessionRepository());
const audioSession = new AudioSessionService(audioSessionStore, {
    engine: audioEngine,
    repository: sessionRepository,
    fileAccess: platform.audioFiles,
});
usePlaybackKeyboard(audioSession, () => !shutdownBusy.value);
const analysisCoordinator = new AnalysisCoordinator(audioEngine, sessionRepository, audioSessionStore);
audioSession.setVolume(configStore.volume);
void audioSession.setPlaybackRate(configStore.playbackRate);
watchEffect(() => audioSession.setPreferredPlaybackMode(configStore.playbackMode));
provide(audioSessionServiceKey, audioSession);
const editorProcessingGate = new EditorProcessingGate();
const editorSeparation = new EditorSeparationService(audioEngine, audioSession, { gate: editorProcessingGate });
analysisCoordinator.configureStemSources(editorSeparation);
watch(
    () => [layoutRoute.path, audioSessionStore.currentTrackId, audioSessionStore.playback.state],
    () => {
        const state = audioSessionStore.playback;
        if (
            !shutdownBusy.value &&
            /^\/(analyzer|editor|visualizer)(\/|$)/.test(layoutRoute.path) &&
            ['paused', 'playing', 'ended'].includes(state.state) &&
            state.trackId
        )
            void editorSeparation.bind(state.trackId);
    },
    { flush: 'post', immediate: true },
);
provide(editorSeparationServiceKey, editorSeparation);
provide(analysisCoordinatorKey, analysisCoordinator);
provide(realtimeBrowserKey, { engine: audioEngine, audio: audioSession, analysis: analysisCoordinator });
const editorController = new EditorSessionController({
    audioSession,
    analysisCoordinator,
    store: audioSessionStore,
    repository: new EditorDraftRepository(),
    fileGateway: new NativeEditorFileGateway(platform.transfers),
});
provide(editorSessionControllerKey, editorController);
const editorTranscription = new EditorTranscriptionService(
    audioSession,
    editorController,
    editorSeparation,
    editorProcessingGate,
);
provide(editorTranscriptionServiceKey, editorTranscription);
const audioReady = audioSession
    .initialize(cache => {
        analysisCoordinator.setRestoredCache(cache);
    })
    .then(() => undefined);
const visualizerController = new VisualizerSessionController({
    audioSession,
    decodedAudio: audioEngine,
    audioReady,
    analysisCoordinator,
    store: audioSessionStore,
    repository: new CompositionDraftRepository(),
    fileGateway: new NativeVisualizerFileGateway(platform.transfers),
    videoGateway: new NativeVisualizerVideoFileGateway(platform.transfers),
    editorRepository: new EditorDraftRepository(),
    editorFileGateway: new NativeEditorFileGateway(platform.transfers),
});
provide(visualizerSessionControllerKey, visualizerController);

let disposal: Promise<void> | null = null;
function disposeRuntime() {
    disposal ??= (async () => {
        const failures: unknown[] = [];
        for (const release of [
            () => editorTranscription.dispose(),
            () => editorSeparation.dispose(),
            () => visualizerController.dispose(),
            () => editorController.dispose(),
            () => analysisCoordinator.dispose(),
            () => audioSession.dispose(),
        ])
            try {
                await release();
            } catch (error) {
                failures.push(error);
            }
        await sessionRepository.flush();
        if (failures.length) throw Error('部分运行时资源未能释放，请重试关闭。');
    })();
    return disposal;
}
const application = getCurrentInstance()!.appContext.app;
const detachShutdown = platform.lifecycle.register(
    createRuntimeShutdown({
        audio: audioSession,
        analysis: analysisCoordinator,
        editor: editorController,
        visualizer: visualizerController,
        transcription: editorTranscription,
        separation: editorSeparation,
        repository: sessionRepository,
        session: () => ({ persistence: audioSessionStore.persistence, playback: audioSessionStore.playback }),
        audioReady,
        lock: locked => {
            shutdownBusy.value = locked;
        },
        dispose: disposeRuntime,
        unmount: () => application.unmount(),
    }),
);

interface M6DevelopmentBridge {
    setActiveFeatures(ids: string[]): Promise<void>;
    cancel(): void;
    retry(): Promise<void>;
    getState(): ReturnType<AnalysisCoordinator['getSnapshot']> & {
        series: Array<{
            featureId: FeatureId;
            sampleCount: number;
            sampleStepSeconds: number;
            payloadKind: string;
            dimensions: readonly number[];
        }>;
    };
    getCursorValue(featureId: string, timeSeconds: number): ReturnType<AnalysisCoordinator['requestCursorValue']>;
}

let developmentBridge: M6DevelopmentBridge | null = null;
if (import.meta.env.DEV) {
    developmentBridge = {
        async setActiveFeatures(ids) {
            if (!ids.every(isFeatureId)) {
                throw new TypeError('Unknown analysis feature ID.');
            }
            const proxy = analysisCoordinator.getDevelopmentConsumerProxy('analyzer');
            if (!proxy) throw new Error('Analyzer consumer is not active.');
            await proxy.setActiveFeatures(ids);
        },
        cancel() {
            if (analysisCoordinator.getDevelopmentConsumerProxy('analyzer')) {
                analysisCoordinator.cancel();
            }
        },
        retry() {
            const proxy = analysisCoordinator.getDevelopmentConsumerProxy('analyzer');
            return proxy
                ? proxy.setActiveFeatures(analysisCoordinator.getSnapshot().activeFeatureIds)
                : Promise.resolve();
        },
        getState() {
            const snapshot = analysisCoordinator.getSnapshot();
            return {
                ...snapshot,
                series: snapshot.readyFeatureIds.flatMap(featureId => {
                    const series =
                        analysisCoordinator.getDevelopmentConsumerProxy('analyzer')?.getSeries(featureId) ?? null;
                    return series
                        ? [
                              {
                                  featureId,
                                  sampleCount: series.sampleCount,
                                  sampleStepSeconds: series.sampleStepSeconds,
                                  payloadKind: series.payload.kind,
                                  dimensions: series.dimensions,
                              },
                          ]
                        : [];
                }),
            };
        },
        getCursorValue(featureId, timeSeconds) {
            if (!isFeatureId(featureId)) return Promise.resolve(null);
            return (
                analysisCoordinator
                    .getDevelopmentConsumerProxy('analyzer')
                    ?.requestCursorValue(featureId, timeSeconds) ?? Promise.resolve(null)
            );
        },
    };
    (
        window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__?: M6DevelopmentBridge;
        }
    ).__AUDIO_NOT_SURF_YET_M6__ = developmentBridge;
}

onUnmounted(() => {
    detachShutdown();
    if (previousSidebarWidth) document.documentElement.style.setProperty('--app-sidebar-width', previousSidebarWidth);
    else document.documentElement.style.removeProperty('--app-sidebar-width');
    if (developmentBridge) {
        delete (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__?: M6DevelopmentBridge;
            }
        ).__AUDIO_NOT_SURF_YET_M6__;
    }
    void disposeRuntime().catch(() => {
        console.error('Application resource cleanup failed');
    });
});
</script>

<style scoped>
#main-layout {
    min-height: 100dvh;
    background-color: var(--canvas);
}
.app-content {
    width: calc(100% - var(--app-sidebar-inset));
    min-height: 100dvh;
    margin-left: var(--app-sidebar-inset);
    container: app-workspace / inline-size;
    transition:
        width 180ms ease,
        margin-left 180ms ease;
}
.presentation-content {
    width: 100%;
    margin-left: 0;
    transition: none;
}
@media (max-width: 767px) {
    .app-content {
        transition: none;
    }
}
</style>
