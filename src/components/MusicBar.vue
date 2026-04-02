<template>
    <div id="music-bar-container">
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
                <div id="progress-bar-container" @mousedown="handleDragStart">
                    <div id="progress-button"></div>
                    <div class="mt-2" style="pointer-events: none;">
                        {{ currentTimeText + "/" + (albumInfo[playingTarget]?.duration || '00:00') }}
                    </div>
                </div>
                <div class="w-full flex justify-center">
                    <div class="flex gap-2 items-center">
                        <svg class="w-8 h-8 cursor-pointer" @click="togglePrev">
                            <use href="/icons.svg#prev-song"></use>
                        </svg>
                        <svg class="w-8 h-8 cursor-pointer rotate-180" @click="togglePause">
                            <use href="/icons.svg#play-music" v-if="!isPlaying"></use>
                            <use href="/icons.svg#pause-music" v-else></use>
                        </svg>
                        <svg class="w-8 h-8 cursor-pointer" @click="toggleNext">
                            <use href="/icons.svg#next-song"></use>
                        </svg>
                    </div>
                </div>
            </section>
            <section class="flex gap-4 items-center justify-end w-80 m-1">
                <svg class="w-7 h-7 cursor-pointer">
                    <use href="/icons.svg#volume-control"></use>
                </svg>
                <svg class="w-7 h-7 cursor-pointer" @click="toggleMusicList">
                    <use href="/icons.svg#music-list"></use>
                </svg>
                <svg class="w-7 h-7 cursor-pointer" @click="toggleSelectFile">
                    <use href="/icons.svg#add-music"></use>
                </svg>
                <svg class="w-7 h-7 cursor-pointer" @click="toggleChangeStyle">
                    <use href="/icons.svg#change-style"></use>
                </svg>
                <svg class="w-7 h-7 cursor-pointer">
                    <use href="/icons.svg#more-menu"></use>
                </svg>
            </section>
        </div>
        <aside class="music-list-container">
            <MusicList :info="albumInfo" @SelectIndex="handleSelectIndex" @AddToAnalysis="handleAddToAnalysis"
                @Delete="(index) => toggleDelete(index)" @Clear="toggleClear" @CloseList="toggleMusicList" />
        </aside>
    </div>
</template>

<script setup lang="ts">
import gsap from 'gsap';
import Meyda from 'meyda';
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { AudioLoader } from '../audio/AudioLoader';
import { parseBlob } from 'music-metadata';
import { mapEnergyToDeg, formatSecToTime, clamp } from '../utils/utils';
import MusicList from './MusicList.vue';

//初始化音频加载器
const audioLoader = new AudioLoader();

const tl1 = gsap.timeline();
const tl2 = gsap.timeline();
onMounted(() => {
    /** 初始化动画 */
    tl1.to('#music-bar-container', {
        '--offset': '0',
        duration: 0.3,
        ease: 'linear'
    }).pause();
    tl2.to('.music-list-container', {
        transform: 'translateX(0%)',
        duration: 0.3,
        ease: 'linear'
    }).pause();
    /** 初始化信息滚动动画 */
    setupInfoMarquee();
    const el = document.getElementById('music-info-container');
    if (el) {
        resizeObserver = new ResizeObserver(() => setupInfoMarquee());
        resizeObserver.observe(el);
    }
});

//滚动动画
let resizeObserver: ResizeObserver | null = null;
const marqueeTweens: gsap.core.Tween[] = [];

//销毁动画/监听器
onUnmounted(() => {
    tl1.kill();
    tl2.kill();
    resizeObserver?.disconnect();
    marqueeTweens.forEach((t) => t.kill());
    marqueeTweens.length = 0;
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    stopProgressLoop();
});

//切换样式
const styleMode = ref(false);
const toggleChangeStyle = () => {
    styleMode.value = !styleMode.value;
    styleMode.value ? tl1.play() : tl1.reverse();
};

//暂停/续播
const isPlaying = ref(false);
const progressPercent = ref(0);
const currentTimeText = ref('00:00');
let progressRafId: number | null = null;

/** 更新进度条UI */
const updateProgressUI = () => {
    progressPercent.value = audioLoader.getCurrentProgressPercent();
    progressWidthPercent = progressPercent.value;
    setProgressButton(progressPercent.value);
    currentTimeText.value = formatSecToTime(audioLoader.getCurrentTimeSec());
};
const stopProgressLoop = () => {
    if (progressRafId !== null) {
        cancelAnimationFrame(progressRafId);
        progressRafId = null;
    }
};
const startProgressLoop = () => {
    stopProgressLoop();
    const tick = () => {
        updateProgressUI();
        if (isPlaying.value) {
            progressRafId = requestAnimationFrame(tick);
        } else {
            progressRafId = null;
        }
    };
    progressRafId = requestAnimationFrame(tick);
};

/** 音频播放控制 */
const pauseCurrent = () => {
    audioLoader.pause();
    isPlaying.value = false;
    stopProgressLoop();
    updateProgressUI();
};
const playCurrent = () => {
    if (!audioLoader.hasLoaded()) return;
    if (audioLoader.getCurrentProgressPercent() >= 1) {
        audioLoader.setPlaybackOffsetPercent(0);
    }
    audioLoader.resume();
    isPlaying.value = true;
    updateProgressUI();
    startProgressLoop();
};
const getNormalizedIndex = (index: number) => {
    const len = musicFileUrl.value.length;
    if (len === 0) return -1;
    return (index + len) % len;
};

let isLoading = false;
const playAt = async (index: number) => {
    if (isLoading) return;
    isLoading = true;
    const nextIndex = getNormalizedIndex(index);
    if (nextIndex < 0) return;
    playingTarget.value = nextIndex;
    const url = musicFileUrl.value[nextIndex];
    if (!url) return;
    await audioLoader.loadAudio(url);
    audioLoader.setOnEndedCallback(() => {
        if (isLoading) return;
        void playAt(playingTarget.value + 1);
    });
    audioLoader.resume();
    isPlaying.value = true;
    currentTimeText.value = '00:00';
    updateProgressUI();
    startProgressLoop();
    isLoading = false;
};

const togglePause = () => {
    if (isPlaying.value) {
        pauseCurrent();
        return;
    }
    if (audioLoader.hasLoaded()) {
        playCurrent();
        return;
    }
    void playAt(playingTarget.value);
};
const toggleNext = () => {
    void playAt(playingTarget.value + 1);
};
const togglePrev = () => {
    void playAt(playingTarget.value - 1);
};
const toggleDelete = (index: number) => {
    if (index < 0 || index >= musicFileUrl.value.length) return;
    const url = musicFileUrl.value[index];
    if (url) URL.revokeObjectURL(url);
    musicFileUrl.value.splice(index, 1);
    albumInfo.value.splice(index, 1);
    const isCur = index === playingTarget.value;
    if (musicFileUrl.value.length === 0) {
        pauseCurrent();
        playingTarget.value = 0;
        audioLoader.destroy();
        updateProgressUI();
        toggleRealTime();
        return;
    }
    if (isCur) {
        pauseCurrent();
        const nextIndex = index >= musicFileUrl.value.length ? musicFileUrl.value.length - 1 : index;
        void playAt(nextIndex);
        return;
    }
    if (index < playingTarget.value) {
        playingTarget.value--;
    }
};
const toggleClear = () => {
    pauseCurrent();
    musicFileUrl.value.forEach(url => URL.revokeObjectURL(url));
    musicFileUrl.value = [];
    albumInfo.value = [];
    playingTarget.value = 0;
    progressPercent.value = 0;
    currentTimeText.value = '00:00';
    audioLoader.destroy();
    updateProgressUI();
    toggleRealTime();
};

let musicListVisible = false;
const toggleMusicList = () => {
    musicListVisible = !musicListVisible;
    musicListVisible ? tl2.play() : tl2.reverse();
};

//加载音频文件
const musicFileUrl = ref<string[]>([]);
const playingTarget = ref<number>(0);
const albumInfo = ref<{
    albumCover: string;
    fileName: string;
    title: string;
    artist: string;
    duration: string;
}[]>([]);
const toggleSelectFile = () => {
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'audio/*';
    file.multiple = true;
    file.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files) {
            for (const file of files) {
                await getAudioInfo(file);
                musicFileUrl.value.push(URL.createObjectURL(file));
            }
            if (musicFileUrl.value.length > 0) {
                void playAt(playingTarget.value);
            }
        }
    };
    file.click();
};

//获取音频信息
const getAudioInfo = async (file: File) => {
    await parseBlob(file).then(metadata => {
        const cover = metadata.common.picture?.[0] || null;
        let url: string = '/default_cover.png';
        if (cover) {
            let blob = new Blob([cover.data as BlobPart], { type: 'image/png' });
            url = URL.createObjectURL(blob);
        }
        albumInfo.value.push({
            albumCover: url,
            fileName: file.name || 'unknown',
            title: metadata.common.title || 'unknown',
            artist: metadata.common.artist || 'unknown',
            duration: formatSecToTime(metadata.format.duration || 0),
        });

    });
}

//实时音频响应
let raiseSpeed = 0.5;
let fallSpeed = 0.05;
let previousEnergy = 0;
const toggleRealTime = () => {
    let rafId: number | null = null;
    const processElement = document.getElementById('music-bar-container');
    if (audioLoader.getTimeDomainFloatData() && isPlaying.value) {
        rafId = requestAnimationFrame(() => {
            const features = Meyda.extract(
                ['energy'],
                audioLoader.getTimeDomainFloatData() as Float32Array
            );
            let currentEnergy = features?.energy || 0;
            let prev = previousEnergy;
            if (currentEnergy > prev) {
                previousEnergy = currentEnergy * raiseSpeed + prev * (1 - raiseSpeed);
            } else {
                previousEnergy = currentEnergy * fallSpeed + prev * (1 - fallSpeed);
            }

            processElement?.setAttribute(
                'style',
                `--coinc-process: ${mapEnergyToDeg(previousEnergy)}deg;`);
            toggleRealTime();
        });
    } else {
        processElement?.setAttribute('style', '--coinc-process: 0deg;');
        rafId ? cancelAnimationFrame(rafId) : null;
        rafId = null;
    }
}
watch(isPlaying, (newVal) => {
    if (newVal) {
        toggleRealTime();
    }
});

const infoLines = computed(() => [
    albumInfo.value[playingTarget.value]?.fileName || 'unknown file',
    albumInfo.value[playingTarget.value]?.title || 'unknown title',
    albumInfo.value[playingTarget.value]?.artist || 'unknown artist',
]);

/** 仅当单行文字宽度大于可视区域时为 true，用于拼接第二段以实现无缝循环 */
const shouldMarquee = ref<boolean[]>([false, false, false]);
const MARQUEE_PX_PER_SEC = 40;

/**
 * 设置信息滚动动画
 * 当单行文字宽度大于可视区域时，启用滚动动画
 */
function setupInfoMarquee() {
    const container = document.getElementById('music-info-container');
    if (!container) return;

    marqueeTweens.forEach((t) => t.kill());
    marqueeTweens.length = 0;
    shouldMarquee.value = [false, false, false];
    nextTick(() => {
        const wraps = container.querySelectorAll('.info-line-wrap');
        const next: boolean[] = [];
        wraps.forEach((wrap) => {
            const textEl = wrap.querySelector('.info-text') as HTMLElement | null;
            console.log('textEl', textEl?.scrollWidth, wrap.clientWidth);
            if (!textEl) {
                next.push(false);
                return;
            }
            next.push(textEl.scrollWidth > wrap.clientWidth);
        });
        shouldMarquee.value = next;
        nextTick(() => {
            wraps.forEach((wrap, idx) => {
                const track = wrap.querySelector('.info-marquee-track') as HTMLElement | null;
                track?.style.setProperty('transform', 'translate3d(0, 0, 0)');
                if (!track || !shouldMarquee.value[idx]) return;
                // if (!shouldMarquee.value[idx]) return;
                gsap.set(track, { x: 0 });
                const half = track.scrollWidth / 2;
                if (half <= 0) return;
                const tween = gsap.to(track, {
                    x: -half,
                    duration: Math.max(0.001, half / MARQUEE_PX_PER_SEC),
                    ease: 'none',
                    repeat: -1,
                });
                marqueeTweens.push(tween);
            });
        });
    });
}

watch(() => albumInfo.value[playingTarget.value], () => {
    console.log('albumInfo changed', albumInfo.value[playingTarget.value]);
    setupInfoMarquee()
}, { deep: true });

/** 拖动进度条 */
let progressWidthPercent = 0;
let wasPlayingBeforeDrag = false;
const updateProgressWidthPercent = (e: MouseEvent) => {
    const progressBar = document.getElementById('progress-bar-container');
    if (progressBar) {
        const progressBarWidth = progressBar.clientWidth;
        let temp = (e.clientX - progressBar.getBoundingClientRect().left) / progressBarWidth;
        progressWidthPercent = clamp(temp, 0, 1);
    }
}
const setProgressButton = (percent: number) => {
    const el = document.getElementById('progress-bar-container');
    el?.setAttribute('style', `--progress-width: ${percent * 100}%`);
}
const setProgressTime = (percent: number) => {
    if (!audioLoader) return;
    audioLoader.setPlaybackOffsetPercent(percent);
    currentTimeText.value = formatSecToTime(audioLoader.getCurrentTimeSec());
}
const handleDragStart = (e: MouseEvent) => {
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    wasPlayingBeforeDrag = isPlaying.value;
    if (wasPlayingBeforeDrag) {
        pauseCurrent();
    }
    updateProgressWidthPercent(e);
    setProgressButton(progressWidthPercent);
    currentTimeText.value = formatSecToTime(audioLoader.getDurationSec() * progressWidthPercent);
}
const handleDragMove = (e: MouseEvent) => {
    updateProgressWidthPercent(e);
    setProgressButton(progressWidthPercent);
    currentTimeText.value = formatSecToTime(audioLoader.getDurationSec() * progressWidthPercent);
}
const handleDragEnd = () => {
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    setProgressTime(progressWidthPercent);
    updateProgressUI();
    if (wasPlayingBeforeDrag) {
        playCurrent();
    }
    wasPlayingBeforeDrag = false;
}
/** 选择音乐 */
const handleSelectIndex = (index: number) => {
    playAt(index);
}
const handleAddToAnalysis = (index: number) => {
    console.log('handleAddToAnalysis', index);
}
</script>

<style scoped>
#music-bar-container {
    user-select: none;
    --offset: 2rem;
    --border-width: 3px;
    --coinc-process: 0deg;
    --coinc-remain: calc(360deg - var(--coinc-process));
    position: fixed;
    width: calc(100% - var(--offset) * 2 + var(--border-width) * 2);
    height: calc(4rem + var(--border-width) * 2);
    left: calc(var(--offset) - var(--border-width));
    bottom: calc(var(--offset) / 4 - var(--border-width));
    border-radius: calc(var(--offset) * 2);
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

/* 音乐信息 */
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

/* 进度条 */
#progress-bar-container {
    --progress-width: 0%;
    width: 100%;
    height: 5px;
    background-color: #444;
    border-radius: 100px;
    position: relative;
}

#progress-bar-container::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: var(--progress-width);
    background-color: #eaeaea;
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
}
</style>