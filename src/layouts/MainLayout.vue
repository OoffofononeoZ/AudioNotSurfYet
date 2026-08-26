<template>
    <main class="min-w-full h-dvh bg-black" id="main-layout">
        <HeaderBar />
        <router-view />
        <MusicBar v-if="!editorPlaybackActive" :progress="0" />
    </main>
</template>

<script setup lang="ts">
import { computed, onUnmounted, provide, shallowRef } from 'vue';
import HeaderBar from '../components/HeaderBar.vue';
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

const audioSessionStore = useAudioSessionStore();
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
audioSession.setVolume(useConfigstore().volume);
provide(audioSessionServiceKey, audioSession);
provide(analysisCoordinatorKey, analysisCoordinator);
const editorController = new EditorSessionController({
    audioSession,
    analysisCoordinator,
    store: audioSessionStore,
    repository: new EditorDraftRepository(),
    fileGateway: new NativeEditorFileGateway(),
});
provide(editorSessionControllerKey, editorController);
const editorSnapshot = shallowRef(editorController.getSnapshot());
const unsubscribeEditor = editorController.subscribe((snapshot) => {
    editorSnapshot.value = snapshot;
});
const editorPlaybackActive = computed(() =>
    editorSnapshot.value.activeTrackId !== null
    && ['ready', 'draft-conflict', 'draft-error'].includes(
        editorSnapshot.value.state,
    ));
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
    unsubscribeEditor();
    if (developmentBridge) {
        delete (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__?: M6DevelopmentBridge;
            }
        ).__AUDIO_NOT_SURF_YET_M6__;
    }
    void (async () => {
        await editorController.dispose();
        await analysisCoordinator.dispose();
        await audioSession.dispose();
    })();
});
</script>

<style scoped>

</style>
