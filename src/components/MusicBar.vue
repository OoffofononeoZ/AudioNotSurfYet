<template>
    <div id="music-bar-container" :class="'bg-style-' + styleMode"
        :data-playback-state="playback.state"
        :data-current-time="playback.currentTimeSeconds"
        :data-duration="playback.durationSeconds"
        :data-volume="playback.volume"
        :data-current-track-id="currentTrackId || ''"
        :data-energy="currentEnergy"
        :data-persistence-state="persistence.state">
        <div class="h-16" id="music-bar">
            <section class="max-h-15 m-1 flex items-center gap-4 w-80">
                <div id="albumCoverContainer">
                    <img :src="albumInfo[playingTarget]?.albumCover || '/default_cover.png'" alt="album cover"
                        class="w-14 aspect-square object-cover min-w-14">
                </div>
                <div class="flex flex-col text-sm max-w-60" id="music-info-container">
                    <div v-for="(text, idx) in infoLines" :key="idx" class="info-line-wrap">
                        <div class="info-marquee-track">
                            <span class="info-text">{{ text }}</span>
                            <template v-if="shouldMarquee[idx]">
                                <span class="info-text">{{ text }}</span>
                            </template>
                        </div>
                    </div>
                </div>
            </section>
            <section class="flex-col flex w-1/2 mt-4 gap-1.5">
                <div class="progress-bar-slot">
                    <div id="progress-bar-container" data-testid="playback-progress" :class="{
                        'progress-bar-hidden': isStyleTransitioning,
                        'progress-bar-disabled': !canSeek,
                    }" :aria-disabled="!canSeek" @mousedown="handleDragStart"
                        @mouseenter="hovering = canSeek && !isStyleTransitioning" @mouseleave="hovering = false">
                        <div id="progress-button" v-show="hovering && canSeek && !isStyleTransitioning"
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
                            aria-label="上一首" @click="togglePrev" @keydown.enter="togglePrev">
                            <use href="/icons.svg#prev-song"></use>
                        </svg>
                        <svg class="w-8 h-8 cursor-pointer rotate-180" data-testid="toggle-playback" role="button"
                            tabindex="0" :aria-label="isPlaying ? '暂停' : '播放'" @click="togglePause"
                            @keydown.enter="togglePause">
                            <use href="/icons.svg#play-music" v-if="!isPlaying"></use>
                            <use href="/icons.svg#pause-music" v-else></use>
                        </svg>
                        <svg class="w-8 h-8 cursor-pointer" data-testid="next-track" role="button" tabindex="0"
                            aria-label="下一首" @click="toggleNext" @keydown.enter="toggleNext">
                            <use href="/icons.svg#next-song"></use>
                        </svg>
                    </div>
                </div>
            </section>
            <section class="flex gap-4 items-center justify-end w-80 m-1">
                <el-tooltip placement="top">
                    <svg class="w-7 h-7 cursor-pointer" data-testid="volume-control">
                        <use href="/icons.svg#volume-control"></use>
                    </svg>
                    <template #content>
                        <div class="pt-2 pb-4 flex flex-col items-center" style="margin: -5px;">
                            <span class="pb-2">{{ volume }}%</span>
                            <el-slider vertical height="100px" :showTooltip="false" :max="100" :min="0" :step="1"
                                v-model="volume" @change="setVolume"></el-slider>
                        </div>
                    </template>
                </el-tooltip>
                <svg class="w-7 h-7 cursor-pointer" data-testid="toggle-queue" @click="toggleMusicList">
                    <use href="/icons.svg#music-list"></use>
                </svg>
                <svg class="w-7 h-7 cursor-pointer" data-testid="import-audio" role="button" tabindex="0"
                    aria-label="导入本地音频" @click="toggleSelectFile" @keydown.enter="toggleSelectFile">
                    <use href="/icons.svg#add-music"></use>
                </svg>
                <svg class="w-7 h-7 cursor-pointer" data-testid="change-musicbar-style" @click="toggleChangeStyle">
                    <use href="/icons.svg#change-style"></use>
                </svg>
                <svg class="w-7 h-7 cursor-pointer">
                    <use href="/icons.svg#more-menu"></use>
                </svg>
            </section>
        </div>
        <aside class="music-list-container">
            <MusicList :info="albumInfo" :persistence="persistence" @select-index="handleSelectIndex"
                @add-to-analysis="handleAddToAnalysis" @delete="toggleDelete" @clear="toggleClear"
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
import gsap from 'gsap';
import {
    ElMessage,
    ElSlider,
    ElTooltip,
} from 'element-plus';
import { useAudioSessionService } from '../audio/audioSessionService';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import { useConfigstore } from '../stores/configStore';
import { clamp, formatSecToTime, mapEnergyToDeg } from '../utils/utils';
import MusicList from './MusicList.vue';

const configStore = useConfigstore();
const audioSessionStore = useAudioSessionStore();
const audioSession = useAudioSessionService();
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
const isPlaying = computed(() => playback.value.state === 'playing');
const isLoading = computed(() => playback.value.state === 'loading');
const audioReady = computed(() =>
    ['paused', 'playing', 'ended'].includes(playback.value.state),
);
const canSeek = computed(() =>
    queue.value.length > 0
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
const marqueeTweens: gsap.core.Tween[] = [];
let musicListVisible = false;
let previousEnergy = 0;

onMounted(() => {
    tl1.to('#music-bar-container', {
        '--offset': '0',
        duration: 0.3,
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
        duration: 0.3,
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

    if (styleMode.value === 1) {
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
            nextTick(() => tl3.play());
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
    const nextVolume = Array.isArray(value) ? (value[0] ?? 0) : value;
    audioSession.setVolume(nextVolume);
};

const toggleMusicList = () => {
    musicListVisible = !musicListVisible;
    musicListVisible ? tl2.play() : tl2.reverse();
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
    albumInfo.value[playingTarget.value]?.artist || 'unknown artist',
]);

const shouldMarquee = ref<boolean[]>([false, false, false]);
const MARQUEE_PX_PER_SEC = 40;

function setupInfoMarquee() {
    const container = document.getElementById('music-info-container');
    if (!container) return;

    marqueeTweens.forEach((tween) => tween.kill());
    marqueeTweens.length = 0;
    shouldMarquee.value = [false, false, false];
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
    () => albumInfo.value[playingTarget.value],
    () => setupInfoMarquee(),
    { deep: true },
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
const handleAddToAnalysis = (_index: number) => {
    // Analyzer integration starts in M7.
};
</script>

<style scoped>
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

.bg-style-2 {
    background: rgb(145, 145, 145);
}

#music-bar {
    width: calc(100% - var(--offset) * 2);
    margin: 0 var(--offset);
    padding: 0 2rem;
    position: fixed;
    bottom: calc(var(--offset) / 4);
    left: 0;
    z-index: 2;
    border-radius: calc(var(--offset) * 2);
    background-color: rgb(40, 40, 40);
    display: flex;
    justify-content: space-between;
    color: white;
}

.info-line-wrap {
    overflow: hidden;
    min-width: 0;
    max-width: 100%;
}

.info-marquee-track {
    display: inline-flex;
    flex-wrap: nowrap;
    will-change: transform;
}

.info-text {
    padding-right: 20px;
    display: inline-block;
    white-space: nowrap;
}

.progress-bar-slot {
    width: 100%;
    height: 5px;
}

#progress-bar-container {
    --progress-width: 0%;
    width: 100%;
    height: 5px;
    background-color: #444;
    border-radius: 100px;
    position: relative;
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

#progress-bar-container::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: var(--progress-width);
    background: linear-gradient(to right, var(--main-color-tsp), var(--main-color));
    border-radius: 100px;
}

#progress-button {
    width: 10px;
    height: 10px;
    background-color: #fff;
    border-radius: 100px;
    position: absolute;
    top: -50%;
    left: calc(var(--progress-width) - 5px);
    cursor: pointer;
    transition: scale 0.2s ease-in-out;
}

#progress-button:hover {
    scale: 1.3;
}

.music-list-container {
    position: fixed;
    height: calc(100% - 192px);
    top: 96px;
    right: 0;
    max-height: calc(100% - 192px);
    transform: translateX(100%);
    z-index: var(--layer-player-popover);
}

:deep(.el-slider__button) {
    border: solid 2px #40ffda75;
}

:deep(.el-slider__bar) {
    background-color: var(--main-color);
}
</style>
