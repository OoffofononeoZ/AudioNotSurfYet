<template>
    <main class="home-page" data-testid="home-details" :data-track-id="currentTrack?.id ?? ''">
        <LightBg v-if="config.homeDisplayMode !== 'visualizer'" :ray-length="rayLength" class="home-rays" />
        <div
            class="home-content app-scrollbar"
            :class="{ 'home-visualizer-content': config.homeDisplayMode === 'visualizer' }">
            <div class="home-display-switch" aria-label="首页展示">
                <button
                    type="button"
                    :aria-pressed="config.homeDisplayMode !== 'visualizer'"
                    @click="config.homeDisplayMode = 'details'">
                    详情
                </button>
                <button
                    type="button"
                    :aria-pressed="config.homeDisplayMode === 'visualizer'"
                    @click="config.homeDisplayMode = 'visualizer'">
                    可视化
                </button>
            </div>
            <section v-if="config.homeDisplayMode !== 'visualizer'" class="song-details" aria-label="当前歌曲详情">
                <div class="song-identity" aria-live="polite" aria-atomic="true">
                    <h1 data-testid="home-song-title">{{ title }}</h1>
                    <p v-if="currentTrack" class="song-metadata">
                        <span>{{ currentTrack.metadata.artist || '未知艺术家' }}</span>
                        <span v-if="currentTrack.metadata.album" class="song-album">{{
                            currentTrack.metadata.album
                        }}</span>
                    </p>
                    <p v-else class="song-empty-hint">从底部播放器导入本地音频</p>
                </div>
                <div class="song-artwork">
                    <img
                        :key="artworkKey"
                        :src="artworkUrl"
                        :alt="currentTrack ? `${title} 的歌曲封面` : '默认歌曲封面'"
                        :data-artwork-key="artworkKey"
                        data-testid="home-song-cover"
                        @error="handleArtworkError" />
                </div>
            </section>
            <RealtimeVisualizer v-else-if="config.homeStyleId" :style-id="config.homeStyleId" class="home-realtime" />
            <p v-else class="song-details">
                请在 <RouterLink to="/visualizer">Visualizer</RouterLink> 中将画面应用到首页
            </p>
        </div>
    </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import LightBg from '../components/LightBg.vue';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import { useAudioSessionService } from '../audio/audioSessionService';
import { useConfigstore } from '../stores/configStore';
import RealtimeVisualizer from '../components/visualizer/RealtimeVisualizer.vue';
const config = useConfigstore();

const { currentEnergy, currentTrackId, queue } = storeToRefs(useAudioSessionStore());
const audioSession = useAudioSessionService();
const rayLength = computed(() => currentEnergy.value / 60 + 1);
const currentTrack = computed(() => queue.value.find(track => track.id === currentTrackId.value));
const title = computed(() =>
    currentTrack.value ? currentTrack.value.metadata.title || currentTrack.value.name || '未命名歌曲' : '未选择歌曲',
);
const sourceArtwork = computed(() =>
    currentTrack.value ? audioSession.getArtworkUrl(currentTrack.value.id) : undefined,
);
const artworkKey = computed(() => `${currentTrack.value?.id ?? ''}:${sourceArtwork.value ?? ''}`);
const failedArtwork = ref<string | null>(null);
const artworkUrl = computed(() =>
    failedArtwork.value !== artworkKey.value && sourceArtwork.value ? sourceArtwork.value : '/default_cover.png',
);
const handleArtworkError = (event: Event) => {
    const key = (event.currentTarget as HTMLImageElement).dataset.artworkKey;
    if (key === artworkKey.value) failedArtwork.value = key;
};
</script>

<style scoped>
.home-page {
    position: relative;
    isolation: isolate;
    height: 100dvh;
    overflow: hidden;
    color: var(--ink);
    background: var(--canvas);
    font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
}
.home-content.home-visualizer-content {
    padding: 0;
    overflow: hidden;
    background: #000;
}
.home-visualizer-content .home-display-switch {
    position: absolute;
    top: 24px;
    left: 0;
    right: 0;
    z-index: 2;
}
.home-visualizer-content .home-realtime {
    position: absolute;
    inset: 0;
}
.home-rays {
    position: absolute;
    inset: 0;
    z-index: 0;
    opacity: 1;
}
.home-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px 32px 112px;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: transparent;
}
.home-display-switch {
    display: flex;
    justify-content: center;
    gap: 4px;
    flex: none;
}
.home-display-switch button {
    position: relative;
    min-width: 88px;
    padding: 10px 16px;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
}
.home-display-switch button[aria-pressed='true']::after {
    content: '';
    position: absolute;
    left: 20px;
    right: 20px;
    bottom: 0;
    height: 2px;
    border-radius: 2px;
    background: var(--accent-soft);
}
.home-display-switch button:disabled {
    color: var(--mute);
    opacity: 0.55;
    cursor: default;
}
.home-display-switch button:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 2px;
    border-radius: 4px;
}
.song-details {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1 0 auto;
    gap: 30px;
    width: 100%;
    padding-top: 36px;
}
.song-identity {
    width: min(100%, 1080px);
    text-align: center;
}
.song-identity h1 {
    margin: 0;
    font-size: clamp(32px, 5cqw, 64px);
    font-weight: 600;
    line-height: 1.12;
    letter-spacing: -0.04em;
    overflow-wrap: anywhere;
    text-wrap: balance;
}
.song-metadata,
.song-empty-hint {
    margin: 16px 0 0;
    color: var(--body);
    font-size: 15px;
    line-height: 1.6;
    overflow-wrap: anywhere;
}
.song-metadata {
    display: flex;
    align-items: baseline;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px 18px;
}
.song-album {
    color: var(--mute);
}
.song-artwork {
    flex: none;
    width: min(440px, 45dvh, 100%);
    aspect-ratio: 1;
    border: 1px solid rgba(239, 255, 246, 0.12);
    border-radius: 12px;
    overflow: hidden;
    background: var(--surface-1);
    box-shadow: 0 24px 72px rgba(0, 0, 0, 0.5);
}
.song-artwork img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}
@media (max-width: 767px) {
    .home-content {
        padding: 14px 24px 104px;
    }
    .home-visualizer-content .home-display-switch {
        top: 14px;
    }
    .home-display-switch {
        min-height: 36px;
        padding-left: 36px;
    }
    .song-details {
        gap: 24px;
        padding-top: 32px;
    }
}
</style>
