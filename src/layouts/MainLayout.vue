<template>
    <div id="main-layout">
        <AppSidebar />
        <AppSettingsButton />
        <div class="app-content">
            <router-view />
        </div>
        <MusicBar v-if="!routePlaybackActive" :progress="0" />
    </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, provide, shallowRef, watchEffect } from 'vue';
import AppSidebar from '../components/AppSidebar.vue';
import AppSettingsButton from '../components/AppSettingsButton.vue';
import MusicBar from '../components/MusicBar.vue';
import {
    AudioSessionService,
    audioSessionServiceKey,
} from '../audio/audioSessionService';
import { AudioEngine } from '../audio/audioEngine';
import {
    AnalysisCoordinator,
    analysisCoordinatorKey,
} from '../analysis/analysisCoordinator';
import {
    isFeatureId,
    type FeatureId,
} from '../analysis/types';
import { SessionRepository } from '../persistence/sessionRepository';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import { useConfigstore } from '../stores/configStore';
import {
    EditorSessionController,
    editorSessionControllerKey,
} from '../editor/editorSessionController';
import { EditorDraftRepository } from '../editor/editorDraftRepository';
import { NativeEditorFileGateway } from '../editor/fileIO';
import {
    VisualizerSessionController,
    visualizerSessionControllerKey,
} from '../visualizer/visualizerSessionController';
import { VisualizerDraftRepository } from '../visualizer/visualizerDraftRepository';
import { NativeVisualizerFileGateway } from '../visualizer/fileIO';
import { NativeVisualizerVideoFileGateway } from '../visualizer/videoFileIO';
import { EditorSeparationService,editorSeparationServiceKey } from '../processing/editorSeparationService';
import { EditorProcessingGate } from '../processing/editorProcessingGate';
import { EditorTranscriptionService,editorTranscriptionServiceKey } from '../transcription/editorTranscriptionService';

const audioSessionStore = useAudioSessionStore();
const configStore = useConfigstore();
const previousSidebarWidth = document.documentElement.style.getPropertyValue('--app-sidebar-width');
watchEffect(() => {
    document.documentElement.style.setProperty('--app-sidebar-width',
        configStore.sidebarCollapsed ? '64px' : '216px');
});
const audioEngine = new AudioEngine();
const sessionRepository = new SessionRepository();
const audioSession = new AudioSessionService(audioSessionStore, {
    engine: audioEngine,
    repository: sessionRepository,
});
const analysisCoordinator = new AnalysisCoordinator(
    audioEngine,
    sessionRepository,
    audioSessionStore,
);
audioSession.setVolume(configStore.volume);
watchEffect(() => audioSession.setPreferredPlaybackMode(configStore.playbackMode));
provide(audioSessionServiceKey, audioSession);
const editorProcessingGate = new EditorProcessingGate();
const editorSeparation = new EditorSeparationService(audioEngine,audioSession,{gate:editorProcessingGate});
provide(editorSeparationServiceKey,editorSeparation);
provide(analysisCoordinatorKey, analysisCoordinator);
const editorController = new EditorSessionController({
    audioSession,
    analysisCoordinator,
    store: audioSessionStore,
    repository: new EditorDraftRepository(),
    fileGateway: new NativeEditorFileGateway(),
});
provide(editorSessionControllerKey, editorController);
const editorTranscription = new EditorTranscriptionService(audioSession,editorController,editorSeparation,editorProcessingGate);
provide(editorTranscriptionServiceKey,editorTranscription);
const editorSnapshot = shallowRef(editorController.getSnapshot());
const unsubscribeEditor = editorController.subscribe((snapshot) => {
    editorSnapshot.value = snapshot;
});
const editorPlaybackActive = computed(() =>
    editorSnapshot.value.activeTrackId !== null
    && ['ready', 'draft-conflict', 'draft-error'].includes(
        editorSnapshot.value.state,
    ));
const visualizerController = new VisualizerSessionController({
    audioSession,
    analysisCoordinator,
    store: audioSessionStore,
    repository: new VisualizerDraftRepository(),
    fileGateway: new NativeVisualizerFileGateway(),
    videoGateway: new NativeVisualizerVideoFileGateway(),
    editorRepository: new EditorDraftRepository(),
    editorFileGateway: new NativeEditorFileGateway(),
});
provide(visualizerSessionControllerKey, visualizerController);
const visualizerSnapshot = shallowRef(visualizerController.getSnapshot());
const unsubscribeVisualizer = visualizerController.subscribe((snapshot) => {
    visualizerSnapshot.value = snapshot;
});
const visualizerPlaybackActive = computed(() =>
    visualizerSnapshot.value.activeTrackId !== null
    && ['loading', 'ready', 'draft-conflict', 'not-persisted'].includes(
        visualizerSnapshot.value.state,
    ));
const routePlaybackActive = computed(() =>
    editorPlaybackActive.value || visualizerPlaybackActive.value);
void audioSession.initialize().then((cache) => {
    analysisCoordinator.setRestoredCache(cache);
});

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
    getCursorValue(
        featureId: string,
        timeSeconds: number,
    ): ReturnType<AnalysisCoordinator['requestCursorValue']>;
}

let developmentBridge: M6DevelopmentBridge | null = null;
if (import.meta.env.DEV) {
    developmentBridge = {
        async setActiveFeatures(ids) {
            if (!ids.every(isFeatureId)) {
                throw new TypeError('Unknown analysis feature ID.');
            }
            const proxy = analysisCoordinator.getDevelopmentConsumerProxy(
                'analyzer',
            );
            if (!proxy) throw new Error('Analyzer consumer is not active.');
            await proxy.setActiveFeatures(ids);
        },
        cancel() {
            if (analysisCoordinator.getDevelopmentConsumerProxy('analyzer')) {
                analysisCoordinator.cancel();
            }
        },
        retry() {
            const proxy = analysisCoordinator.getDevelopmentConsumerProxy(
                'analyzer',
            );
            return proxy
                ? proxy.setActiveFeatures(
                    analysisCoordinator.getSnapshot().activeFeatureIds,
                )
                : Promise.resolve();
        },
        getState() {
            const snapshot = analysisCoordinator.getSnapshot();
            return {
                ...snapshot,
                series: snapshot.readyFeatureIds.flatMap((featureId) => {
                    const series = analysisCoordinator
                        .getDevelopmentConsumerProxy('analyzer')
                        ?.getSeries(featureId) ?? null;
                    return series
                        ? [{
                            featureId,
                            sampleCount: series.sampleCount,
                            sampleStepSeconds: series.sampleStepSeconds,
                            payloadKind: series.payload.kind,
                            dimensions: series.dimensions,
                        }]
                        : [];
                }),
            };
        },
        getCursorValue(featureId, timeSeconds) {
            if (!isFeatureId(featureId)) return Promise.resolve(null);
            return analysisCoordinator
                .getDevelopmentConsumerProxy('analyzer')
                ?.requestCursorValue(featureId, timeSeconds)
                ?? Promise.resolve(null);
        },
    };
    (
        window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__?: M6DevelopmentBridge;
        }
    ).__AUDIO_NOT_SURF_YET_M6__ = developmentBridge;
}

onUnmounted(() => {
    if (previousSidebarWidth) document.documentElement.style.setProperty('--app-sidebar-width', previousSidebarWidth);
    else document.documentElement.style.removeProperty('--app-sidebar-width');
    unsubscribeEditor();
    unsubscribeVisualizer();
    if (developmentBridge) {
        delete (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__?: M6DevelopmentBridge;
            }
        ).__AUDIO_NOT_SURF_YET_M6__;
    }
    void (async () => {
        await editorTranscription.dispose();
        await editorSeparation.dispose();
        await visualizerController.dispose();
        await editorController.dispose();
        await analysisCoordinator.dispose();
        await audioSession.dispose();
    })();
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
    transition: width 180ms ease, margin-left 180ms ease;
}
@media (max-width: 767px) {
    .app-content { transition: none; }
}
</style>
