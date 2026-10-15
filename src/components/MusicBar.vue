<template>
    <div id="music-bar-container" :class="'bg-style-' + styleMode"
        :data-playback-state="playback.state"
        :data-recording-locked="recordingLocked"
        :data-audition-source="playback.audition?.kind ?? 'original'"
        :data-current-time="playback.currentTimeSeconds"
        :data-duration="playback.durationSeconds"
        :data-volume="playback.volume"
        :data-current-track-id="currentTrackId || ''"
        :data-energy="currentEnergy"
        :data-persistence-state="persistence.state">
        <div class="h-16" id="music-bar">
            <section class="music-info-section max-h-15 m-1 flex items-center gap-4 w-80">
                <div id="albumCoverContainer">
                    <img :src="albumInfo[playingTarget]?.albumCover || '/default_cover.png'" alt="album cover"
                        class="w-14 aspect-square object-cover min-w-14">
                </div>
                <div class="flex flex-col text-sm max-w-60" id="music-info-container">
                    <div v-for="(text, idx) in infoLines" :key="idx" class="info-line-wrap"
                        :class="{
                            'info-line-wrap--subtitle': idx === 1,
                            'info-line-wrap--meta': idx === 2,
                        }">
                        <div class="info-marquee-track">
                            <span class="info-text">{{ text }}</span>
                            <template v-if="shouldMarquee[idx]">
                                <span class="info-text">{{ text }}</span>
                            </template>
                        </div>
                    </div>
                </div>
            </section>
            <section class="transport-section flex-col flex w-1/2 mt-4 gap-1.5">
                <div class="progress-bar-slot">
                    <div id="progress-bar-container" class="app-playback-progress" data-testid="playback-progress" :class="{
                        'progress-bar-hidden': isStyleTransitioning,
                        'progress-bar-disabled': !canSeek,
                    }" role="slider" :tabindex="canSeek ? 0 : -1" aria-label="播放进度"
                        aria-valuemin="0" :aria-valuemax="playback.durationSeconds"
                        :aria-valuenow="dragTimeSeconds ?? playback.currentTimeSeconds"
                        :aria-valuetext="currentTimeText + '/' + (albumInfo[playingTarget]?.duration || '00:00')"
                        :aria-disabled="!canSeek" @mousedown="handleDragStart" @keydown="handleProgressKeydown"
                        @mouseenter="hovering = canSeek && !isStyleTransitioning" @mouseleave="hovering = false">
                        <div id="progress-button" class="app-playback-progress__thumb" v-show="hovering && canSeek && !isStyleTransitioning"
                            ref="progressBarRef"></div>
                        <div class="pt-1" style="pointer-events: none;" v-if="styleMode !== 2">
                            {{ currentTimeText + "/" + (albumInfo[playingTarget]?.duration || '00:00') }}
                        </div>
                        <el-tooltip v-if="hovering && canSeek && styleMode === 2 && !isStyleTransitioning"
                            :visible="hovering" virtualTriggering :virtualRef="progressBarRef"
                            :content="currentTimeText + '/' + (albumInfo[playingTarget]?.duration || '00:00')"
                            :showArrow="false" placement="top" />
                    </div>
                </div>
                <div class="w-full flex justify-center"
                    :style="styleMode === 2 ? { transform: 'translateY(-11px)' } : {}">
                    <div class="flex gap-2 items-center">
                        <svg class="w-8 h-8 cursor-pointer" data-testid="previous-track" role="button" tabindex="0"
                            aria-label="上一首" @click="togglePrev" @keydown.enter.prevent="togglePrev"
                            @keydown.space.prevent="togglePrev">
                            <use href="/icons.svg#prev-song"></use>
                        </svg>
                        <svg class="w-8 h-8 cursor-pointer rotate-180" data-testid="toggle-playback" role="button"
                            tabindex="0" :aria-label="isPlaying ? '暂停' : '播放'" @click="togglePause"
                            @keydown.enter.prevent="togglePause" @keydown.space.prevent="togglePause">
                            <use href="/icons.svg#play-music" v-if="!isPlaying"></use>
                            <use href="/icons.svg#pause-music" v-else></use>
                        </svg>
                        <svg class="w-8 h-8 cursor-pointer" data-testid="next-track" role="button" tabindex="0"
                            aria-label="下一首" @click="toggleNext" @keydown.enter.prevent="toggleNext"
                            @keydown.space.prevent="toggleNext">
                            <use href="/icons.svg#next-song"></use>
                        </svg>
                    </div>
                </div>
            </section>
            <MusicBarActions :mode="mode" :mode-label="modeLabel" :mode-locked="modeLocked" :recording-locked="recordingLocked"
                v-model:volume="volume" :queue-open="musicListVisible" :transitioning="isStyleTransitioning"
                @mode="cycleMode" @volume-keydown="handleVolumeKeydown" @volume="setVolume" @queue="toggleMusicList"
                @import="toggleSelectFile" @appearance="toggleChangeStyle"/>
        </div>
        <aside class="music-list-container" :inert="recordingLocked">
            <MusicList :info="albumInfo" :persistence="persistence" @select-index="handleSelectIndex"
                @edit-track="handleEditTrack" @delete="toggleDelete" @clear="toggleClear"
                @restore-access="handleRestoreAccess" @reselect-track="handleReselectTrack"
                @clear-persisted="handleClearPersisted" @close-list="toggleMusicList" />
        </aside>
    </div>
</template>

<script setup lang="ts">
import {
    computed,
    nextTick,
    onMounted,
    onUnmounted,
    ref,
    watch,
} from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import gsap from 'gsap';
import {
    ElMessage,
    ElTooltip,
} from 'element-plus';
import { useAudioSessionService } from '../audio/audioSessionService';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import { useConfigstore } from '../stores/configStore';
import { clamp, formatSecToTime, mapEnergyToDeg } from '../utils/utils';
import MusicList from './MusicList.vue';
import MusicBarActions from './MusicBarActions.vue';
import './controls/playbackProgress.css';
import { PLAYBACK_MODES, PLAYBACK_MODE_LABELS } from '../audio/playbackPolicy';

const configStore = useConfigstore();
const audioSessionStore = useAudioSessionStore();
const audioSession = useAudioSessionService();
const router = useRouter();
const route = useRoute();
const recordingLocked = computed(() => audioSession.playbackPolicy.state.recordingLocked);
const modeLocked = computed(() => route.name === 'visualizer' || audioSession.playbackPolicy.state.modeLocked);
const mode = computed(() => route.name === 'visualizer' ? 'repeat-one' : audioSession.playbackPolicy.state.effectiveMode);
const modeLabel = computed(() => PLAYBACK_MODE_LABELS[mode.value]
    + (modeLocked.value ? '（工作区已锁定）' : ''));
const cycleMode = () => {
    if (recordingLocked.value || modeLocked.value) return;
    configStore.playbackMode = PLAYBACK_MODES[(PLAYBACK_MODES.indexOf(mode.value) + 1) % PLAYBACK_MODES.length]!;
};
const {
    queue,
    currentTrackId,
    playback,
    currentEnergy,
    persistence,
} = storeToRefs(audioSessionStore);

const albumInfo = computed(() =>
    queue.value.map((track) => ({
        id: track.id,
        albumCover:
            audioSession.getArtworkUrl(track.id) ?? '/default_cover.png',
        fileName: track.name || 'unknown',
        title: track.metadata.title || track.name || 'unknown',
        artist: track.metadata.artist || 'unknown',
        duration: formatSecToTime(track.durationSeconds || 0),
        restoreState: track.restoreState,
    })),
);
const playingTarget = computed(() => {
    const index = queue.value.findIndex(
        (track) => track.id === currentTrackId.value,
    );
    return index >= 0 ? index : 0;
});
const isPlaying = computed(() => ['playing','buffering'].includes(playback.value.state));
const isLoading = computed(() => playback.value.state === 'loading');
const audioReady = computed(() =>
    ['paused', 'playing', 'buffering', 'ended'].includes(playback.value.state),
);
const canSeek = computed(() =>
    queue.value.length > 0
    && !recordingLocked.value
    && audioReady.value
    && !isLoading.value
    && playback.value.durationSeconds > 0,
);

const styleMode = computed(() => configStore.musicBarSettings.style);
const isStyleTransitioning = ref(false);
const hovering = ref(false);
const progressBarRef = ref<HTMLElement>();
const dragTimeSeconds = ref<number | null>(null);
const currentTimeText = computed(() =>
    formatSecToTime(
        dragTimeSeconds.value ?? playback.value.currentTimeSeconds,
    ),
);

const volume = computed({
    get: () => configStore.volume,
    set: (value: number) => {
        configStore.volume = value;
    },
});

const tl1 = gsap.timeline();
const tl2 = gsap.timeline();
const tl3 = gsap.timeline();
let resizeObserver: ResizeObserver | null = null;
let playerObserver: ResizeObserver | null = null;
const updatePlayerInset = () => {
    const player=document.getElementById('music-bar-container');
    if(player)document.documentElement.style.setProperty('--app-player-inset',Math.max(0,window.innerHeight-player.getBoundingClientRect().top)+'px');
};
const marqueeTweens: gsap.core.Tween[] = [];
const musicListVisible = ref(false);
let previousEnergy = 0;
const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

onMounted(() => {
    const player=document.getElementById('music-bar-container');
    if(player){playerObserver=new ResizeObserver(updatePlayerInset);playerObserver.observe(player);updatePlayerInset();}
    // A zero-duration paused GSAP tween renders its end state immediately.
    // Keep a near-instant non-zero duration so closed/collapsed initial state
    // remains authoritative while still honoring reduced motion.
    const motionDuration = prefersReducedMotion() ? 0.001 : 0.3;
    tl1.to('#music-bar-container', {
        '--offset': '0',
        duration: motionDuration,
        ease: 'linear',
    }).pause();
    tl1.eventCallback('onComplete', () => {
        isStyleTransitioning.value = false;
    });
    tl1.eventCallback('onReverseComplete', () => {
        isStyleTransitioning.value = false;
    });
    tl2.to('.music-list-container', {
        transform: 'translateX(0%)',
        duration: motionDuration,
        ease: 'linear',
    }).pause();
    tl3.fromTo('#music-bar-container', {
        '--coinc-process': '0deg',
    }, {
        '--coinc-process': '360deg',
        duration: 10,
        ease: 'linear',
        repeat: -1,
    }).pause();

    if (styleMode.value === 1 && !prefersReducedMotion()) {
        tl3.play();
    } else if (styleMode.value === 2) {
        tl1.progress(1).pause();
        resetEnergyProgress(true);
    }

    setProgressButton(progressPercent());
    setupInfoMarquee();
    const infoContainer = document.getElementById('music-info-container');
    if (infoContainer) {
        resizeObserver = new ResizeObserver(() => setupInfoMarquee());
        resizeObserver.observe(infoContainer);
    }
});

onUnmounted(() => {
    tl1.kill();
    tl2.kill();
    tl3.kill();
    resizeObserver?.disconnect();
    playerObserver?.disconnect();
    document.documentElement.style.removeProperty('--app-player-inset');
    marqueeTweens.forEach((tween) => tween.kill());
    marqueeTweens.length = 0;
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
});

const toggleChangeStyle = () => {
    if (isStyleTransitioning.value) return;

    switch (styleMode.value) {
        case 0:
            configStore.musicBarSettings.style = 1;
            if (!prefersReducedMotion()) {
                nextTick(() => tl3.play());
            }
            break;
        case 1:
            isStyleTransitioning.value = true;
            hovering.value = false;
            configStore.musicBarSettings.style = 2;
            tl3.pause();
            resetEnergyProgress(true);
            nextTick(() => tl1.play(0));
            break;
        case 2:
            isStyleTransitioning.value = true;
            hovering.value = false;
            configStore.musicBarSettings.style = 0;
            resetEnergyProgress(true);
            nextTick(() => tl1.reverse());
            break;
    }
};

const togglePause = () => {
    void audioSession.togglePlayback();
};
const toggleNext = () => {
    void audioSession.next();
};
const togglePrev = () => {
    void audioSession.previous();
};
const toggleDelete = (index: number) => {
    const trackId = queue.value[index]?.id;
    if (trackId) void audioSession.deleteTrack(trackId);
};
const toggleClear = () => {
    void audioSession.clear();
};
const setVolume = (value: number | number[]) => {
    const nextVolume = clamp(Array.isArray(value) ? (value[0] ?? 0) : value, 0, 100);
    configStore.volume = nextVolume;
    audioSession.setVolume(nextVolume);
};

const handleVolumeKeydown = (event: KeyboardEvent) => {
    let nextVolume: number | null = null;
    switch (event.key) {
        case 'ArrowDown':
        case 'ArrowLeft':
            nextVolume = volume.value - 5;
            break;
        case 'ArrowUp':
        case 'ArrowRight':
            nextVolume = volume.value + 5;
            break;
        case 'Home':
            nextVolume = 0;
            break;
        case 'End':
            nextVolume = 100;
            break;
    }
    if (nextVolume === null) return;
    event.preventDefault();
    setVolume(clamp(nextVolume, 0, 100));
};

const toggleMusicList = () => {
    musicListVisible.value = !musicListVisible.value;
    musicListVisible.value ? tl2.play() : tl2.reverse();
};

const toggleSelectFile = async () => {
    try {
        await audioSession.selectAndImportFiles();
    } catch (error) {
        ElMessage.error(
            error instanceof Error
                ? error.message
                : '无法导入音频文件',
        );
    }
};

const handleRestoreAccess = async (index: number) => {
    const trackId = queue.value[index]?.id;
    if (!trackId) return;
    await audioSession.restoreAccess(trackId);
};

const handleReselectTrack = async (index: number) => {
    const trackId = queue.value[index]?.id;
    if (!trackId) return;
    try {
        await audioSession.reselectTrack(trackId);
    } catch (error) {
        ElMessage.error(
            error instanceof Error
                ? error.message
                : '无法重新选择文件',
        );
    }
};

const handleClearPersisted = () => {
    void audioSession.clearPersistedSession();
};

const resetEnergyProgress = (forceCssReset = false) => {
    previousEnergy = 0;
    if (styleMode.value !== 1 || forceCssReset) {
        document
            .getElementById('music-bar-container')
            ?.style.setProperty('--coinc-process', '0deg');
    }
};

watch(
    [currentEnergy, isPlaying],
    ([energy, playing]) => {
        if (!playing) {
            resetEnergyProgress();
            return;
        }

        const raiseSpeed = 0.5;
        const fallSpeed = 0.05;
        if (energy > previousEnergy) {
            previousEnergy =
                energy * raiseSpeed + previousEnergy * (1 - raiseSpeed);
        } else {
            previousEnergy =
                energy * fallSpeed + previousEnergy * (1 - fallSpeed);
        }

        const processElement =
            document.getElementById('music-bar-container');
        if (styleMode.value === 0 && processElement) {
            processElement.style.setProperty(
                '--coinc-process',
                `${mapEnergyToDeg(
                    previousEnergy,
                    processElement.clientWidth || 500,
                    70,
                    3,
                    120,
                )}deg`,
            );
        }
    },
);

watch(
    [
        () => playback.value.trackId,
        () => playback.value.error?.code,
        () => playback.value.error?.message,
    ],
    ([, errorCode, errorMessage]) => {
        if (!errorCode) return;
        ElMessage.error(
            errorMessage || '当前音频无法解码，请选择其他文件或重试。',
        );
    },
);

watch(
    [
        () => persistence.value.state,
        () => persistence.value.message,
    ],
    ([state, message], [previousState, previousMessage]) => {
        if (
            !message
            || (state === previousState && message === previousMessage)
        ) {
            return;
        }
        if (state === 'not-persisted') {
            ElMessage.warning(message);
        } else if (
            state === 'unsupported-schema'
            || state === 'restore-error'
        ) {
            ElMessage.error(message);
        }
    },
);

const infoLines = computed(() => [
    albumInfo.value[playingTarget.value]?.fileName || 'unknown file',
    albumInfo.value[playingTarget.value]?.title || 'unknown title',
    [albumInfo.value[playingTarget.value]?.artist || 'unknown artist',
        playback.value.audition?.kind && playback.value.audition.kind !== 'original' ? playback.value.audition.label : '',
        playback.value.state === 'buffering' ? '等待音频数据' : playback.value.error?.code === 'audition-read' ? '试听读取失败' : '',
    ].filter(Boolean).join(' · '),
]);

const shouldMarquee = ref<boolean[]>([false, false, false]);
const MARQUEE_PX_PER_SEC = 40;

function setupInfoMarquee() {
    const container = document.getElementById('music-info-container');
    if (!container) return;

    marqueeTweens.forEach((tween) => tween.kill());
    marqueeTweens.length = 0;
    shouldMarquee.value = [false, false, false];
    if (prefersReducedMotion()) return;
    nextTick(() => {
        const wraps = container.querySelectorAll('.info-line-wrap');
        const next: boolean[] = [];
        wraps.forEach((wrap) => {
            const textElement =
                wrap.querySelector('.info-text') as HTMLElement | null;
            next.push(
                Boolean(textElement)
                && (textElement?.scrollWidth ?? 0)
                    > (wrap as HTMLElement).clientWidth,
            );
        });
        shouldMarquee.value = next;
        nextTick(() => {
            wraps.forEach((wrap, index) => {
                const track =
                    wrap.querySelector(
                        '.info-marquee-track',
                    ) as HTMLElement | null;
                track?.style.setProperty(
                    'transform',
                    'translate3d(0, 0, 0)',
                );
                if (!track || !shouldMarquee.value[index]) return;

                gsap.set(track, { x: 0 });
                const half = track.scrollWidth / 2;
                if (half <= 0) return;
                marqueeTweens.push(gsap.to(track, {
                    x: -half,
                    duration: Math.max(0.001, half / MARQUEE_PX_PER_SEC),
                    ease: 'none',
                    repeat: -1,
                }));
            });
        });
    });
}

watch(
    () => infoLines.value.join('\0'),
    () => setupInfoMarquee(),
    { flush: 'post' },
);

const progressPercent = () => {
    const duration = playback.value.durationSeconds;
    if (duration <= 0) return 0;
    return clamp(playback.value.currentTimeSeconds / duration, 0, 1);
};
const setProgressButton = (percent: number) => {
    document
        .getElementById('progress-bar-container')
        ?.style.setProperty('--progress-width', `${percent * 100}%`);
};

watch(
    [
        () => playback.value.currentTimeSeconds,
        () => playback.value.durationSeconds,
    ],
    () => {
        if (!isDraggingProgress) {
            setProgressButton(progressPercent());
        }
    },
);

let progressWidthPercent = 0;
let wasPlayingBeforeDrag = false;
let isDraggingProgress = false;

const updateProgressWidthPercent = (event: MouseEvent) => {
    const progressBar = document.getElementById('progress-bar-container');
    if (!progressBar || progressBar.clientWidth <= 0) return;

    const offset =
        (event.clientX - progressBar.getBoundingClientRect().left)
        / progressBar.clientWidth;
    progressWidthPercent = clamp(offset, 0, 1);
};

const handleProgressKeydown = (event: KeyboardEvent) => {
    if (!canSeek.value || isStyleTransitioning.value) return;

    const current = playback.value.currentTimeSeconds;
    const duration = playback.value.durationSeconds;
    let target: number | null = null;
    switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
            target = current - 5;
            break;
        case 'ArrowRight':
        case 'ArrowUp':
            target = current + 5;
            break;
        case 'Home':
            target = 0;
            break;
        case 'End':
            target = duration;
            break;
    }
    if (target === null) return;
    event.preventDefault();
    void audioSession.seek(clamp(target, 0, duration));
};

const handleDragStart = (event: MouseEvent) => {
    if (
        event.button !== 0
        || !canSeek.value
        || isStyleTransitioning.value
    ) {
        return;
    }

    isDraggingProgress = true;
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    wasPlayingBeforeDrag = isPlaying.value;
    if (wasPlayingBeforeDrag) {
        void audioSession.togglePlayback();
    }
    updateProgressWidthPercent(event);
    setProgressButton(progressWidthPercent);
    dragTimeSeconds.value =
        playback.value.durationSeconds * progressWidthPercent;
};

const handleDragMove = (event: MouseEvent) => {
    if (!isDraggingProgress || !canSeek.value) return;
    updateProgressWidthPercent(event);
    setProgressButton(progressWidthPercent);
    dragTimeSeconds.value =
        playback.value.durationSeconds * progressWidthPercent;
};

const completeDrag = async () => {
    const shouldResume = wasPlayingBeforeDrag;
    wasPlayingBeforeDrag = false;
    const target =
        playback.value.durationSeconds * progressWidthPercent;
    dragTimeSeconds.value = null;
    await audioSession.seek(target);
    if (shouldResume) {
        await audioSession.togglePlayback();
    }
};

const handleDragEnd = () => {
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    if (!isDraggingProgress) return;

    isDraggingProgress = false;
    void completeDrag();
};

const handleSelectIndex = (index: number) => {
    const trackId = queue.value[index]?.id;
    if (trackId) void audioSession.playTrack(trackId);
};
const handleEditTrack = async (index: number) => {
    const trackId = queue.value[index]?.id;
    if (!trackId) return;
    try {
        await audioSession.playTrack(trackId);
        if (
            audioSessionStore.currentTrackId !== trackId
            || audioSessionStore.playback.trackId !== trackId
            || ['empty', 'loading', 'error'].includes(
                audioSessionStore.playback.state,
            )
        ) {
            ElMessage.error('歌曲当前不可编辑，请先恢复文件访问。');
            return;
        }
        await router.push({ name: 'editor', params: { trackId } });
    } catch (error) {
        ElMessage.error(
            error instanceof Error ? error.message : '无法进入 Editor。',
        );
    }
};
</script>

<style scoped>
#music-bar-container[data-recording-locked="true"] [data-testid="toggle-playback"],
#music-bar-container[data-recording-locked="true"] [data-testid="previous-track"],
#music-bar-container[data-recording-locked="true"] [data-testid="next-track"],
#music-bar-container[data-recording-locked="true"] [data-testid="import-audio"] { opacity: .35; cursor: default; }

#music-bar-container {
    user-select: none;
    --offset: 2rem;
    --border-width: 3px;
    position: fixed;
    width: calc(100% - var(--offset) * 2 + var(--border-width) * 2);
    height: calc(4rem + var(--border-width) * 2);
    left: calc(var(--offset) - var(--border-width));
    bottom: calc(var(--offset) / 4 - var(--border-width));
    border-radius: calc(var(--offset) * 2);
    isolation: isolate;
    z-index: var(--layer-player);
}

.bg-style-0 {
    --coinc-process: 0deg;
    --coinc-remain: calc(360deg - var(--coinc-process));
    background:
        conic-gradient(rgb(145, 145, 145) 0deg var(--coinc-remain),
            transparent var(--coinc-remain) var(--coinc-process),
            rgb(145, 145, 145) var(--coinc-process) 300deg),
        conic-gradient(from 180deg,
            #27ff64,
            #80ff00,
            #fe2912,
            #ff0000,
            #fe2912,
            #80ff00,
            #27ff64);
}

.bg-style-1 {
    --coinc-process: 0deg;
    background: conic-gradient(from var(--coinc-process), red, var(--main-color), rgb(0, 255, 255), violet, red);
}

#music-bar-container.bg-style-2 {
    --border-width: 1px;
    background: transparent;
    border: 1px solid var(--hairline);
}

#music-bar {
    width: calc(100% - var(--offset) * 2);
    margin: 0 var(--offset);
    padding: 0 var(--space-xl);
    position: fixed;
    bottom: calc(var(--offset) / 4);
    left: 0;
    z-index: 2;
    border-radius: calc(var(--offset) * 2);
    background-color: var(--surface-player);
    display: flex;
    justify-content: space-between;
    color: var(--ink-strong);
    gap: 16px;
}

.music-info-section { flex: 0 1 280px; min-width: 0; }
#music-info-container { flex: 1; min-width: 0; }
.transport-section { flex: 1; min-width: 120px; width: auto; }
.actions-section { flex: none; width: auto; }

.info-line-wrap {
    overflow: hidden;
    min-width: 0;
    max-width: 100%;
}

.info-line-wrap--subtitle {
    color: var(--ink);
}

.info-line-wrap--meta {
    color: var(--body);
}

.info-marquee-track {
    display: inline-flex;
    flex-wrap: nowrap;
    will-change: transform;
}

.info-text {
    padding-right: var(--space-xl);
    display: inline-block;
    white-space: nowrap;
}

.progress-bar-slot {
    width: 100%;
    height: 5px;
}

.bg-style-2 #progress-bar-container {
    position: fixed;
    left: 0;
    bottom: 4rem;
    width: 100%;
    z-index: 3;
    border-radius: 0;
}

#progress-bar-container.progress-bar-hidden {
    visibility: hidden;
    pointer-events: none;
}

#progress-bar-container.progress-bar-disabled {
    cursor: not-allowed;
}

#progress-bar-container:not(.progress-bar-disabled) {
    cursor: pointer;
}

svg[role="button"]:focus-visible,
svg[role="slider"]:focus-visible,
#progress-bar-container:focus-visible {
    border-radius: var(--radius-xs);
    outline: 2px solid var(--accent);
    outline-offset: 3px;
}

svg[role="button"]:focus:not(:focus-visible),
svg[role="slider"]:focus:not(:focus-visible),
#progress-bar-container:focus:not(:focus-visible) {
    outline: none;
}

.music-list-container {
    position: fixed;
    top: calc(var(--app-page-top-space) + 12px);
    right: 0;
    height: calc(100dvh - var(--app-page-top-space) - 112px);
    max-height: calc(100dvh - var(--app-page-top-space) - 112px);
    width: min(516px, 100%);
    transform: translateX(100%);
    z-index: var(--layer-player-popover);
}

@media (max-width: 640px) {
    #music-bar-container {
        --offset: 0.5rem;
    }

    #music-bar {
        padding: 0 0.75rem;
    }

    .music-info-section {
        display: none;
    }

    .transport-section {
        flex: 1 1 auto;
        margin-top: 0.25rem;
        gap: 18px;
        min-width: 110px;
        width: auto;
    }

    #progress-bar-container > .pt-1 {
        font-size: 11px;
        line-height: 14px;
    }

    .transport-section :deep(svg) {
        height: 1.75rem;
        width: 1.75rem;
    }

}

@media (prefers-reduced-motion: reduce) {
    #progress-button,
    .info-marquee-track,
    .music-list-container {
        transition-duration: 0.001ms !important;
    }
}
</style>
