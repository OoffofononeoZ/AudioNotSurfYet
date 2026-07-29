<template>
    <main class="min-w-full h-dvh bg-black" id="main-layout">
        <HeaderBar />
        <router-view />
        <MusicBar :progress="0" />
    </main>
</template>

<script setup lang="ts">
import { onUnmounted, provide } from 'vue';
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
void analysisCoordinator.setActiveFeatures([]);
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
            await analysisCoordinator.setActiveFeatures(ids);
        },
        cancel() {
            analysisCoordinator.cancel();
        },
        retry() {
            return analysisCoordinator.retry();
        },
        getState() {
            const snapshot = analysisCoordinator.getSnapshot();
            return {
                ...snapshot,
                series: snapshot.readyFeatureIds.flatMap((featureId) => {
                    const series = analysisCoordinator.getSeries(featureId);
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
            return analysisCoordinator.requestCursorValue(
                featureId,
                timeSeconds,
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
    if (developmentBridge) {
        delete (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__?: M6DevelopmentBridge;
            }
        ).__AUDIO_NOT_SURF_YET_M6__;
    }
    void (async () => {
        await analysisCoordinator.dispose();
        await audioSession.dispose();
    })();
});
</script>

<style scoped>

</style>
