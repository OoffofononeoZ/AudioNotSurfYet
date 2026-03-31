<template>
    <div id="music-bar-container">
        <div class="h-16" id="music-bar">
            <section class="max-h-15 m-1 flex items-center gap-4">
                <div id="albumCoverContainer">
                    <img :src="albumCover" alt="album cover" class="w-14 aspect-square object-cover min-w-14">
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
                    <div class="mt-2" style="pointer-events: none;">{{ "00:00/" + albumInfo.duration }}</div>
                </div>
                <div class="w-full flex justify-center">
                    <div class="flex gap-2 items-center">
                        <svg class="w-8 h-8 cursor-pointer">
                            <use href="/icons.svg#prev-song"></use>
                        </svg>
                        <svg class="w-8 h-8 cursor-pointer rotate-180" @click="togglePause">
                            <use href="/icons.svg#play-music" v-if="!isPlaying"></use>
                            <use href="/icons.svg#pause-music" v-else ></use>
                        </svg>
                        <svg class="w-8 h-8 cursor-pointer">
                            <use href="/icons.svg#next-song"></use>
                        </svg>
                    </div>
                </div>
            </section>
            <section class="flex gap-2 items-center justify-end" style="width: 312px;">
                <button @click="toggleChangeStyle">切换样式</button>
                <!-- <button @click="togglePlay">停止/重播</button> -->
                <button>文件列表</button>
                <button @click="toggleSelectFile">选择文件</button>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import gsap from 'gsap';
import Meyda from 'meyda';
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { AudioLoader } from '../audio/AudioLoader';
import { parseBlob } from 'music-metadata';
import { mapEnergyToDeg, formatSecToTime, clamp } from '../utils/utils';

//初始化音频加载器
const audioLoader = new AudioLoader();

const tl1 = gsap.timeline();
// const tl2 = gsap.timeline();
onMounted(() => {
    /** 初始化动画 */
    tl1.to('#music-bar-container', {
        '--offset': '0',
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
    resizeObserver?.disconnect();
    marqueeTweens.forEach((t) => t.kill());
    marqueeTweens.length = 0;
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
});

//切换样式
const styleMode = ref(false);
const toggleChangeStyle = () => {
    styleMode.value = !styleMode.value;
    styleMode.value ? tl1.play() : tl1.reverse();
};

//播放/停止/续播/暂停
const isPlaying = ref(false);
const togglePause = () => {
    try {
        console.log(musicFileUrl.value);
        isPlaying.value ? audioLoader.pause() : audioLoader.resume();
        isPlaying.value = !isPlaying.value;
    } catch (error) {
        if (musicFileUrl.value) loadAudio(musicFileUrl.value);
    }
};


//加载音频文件
const musicFile = ref<File | null>(null);
const musicFileUrl = ref<string | null>(null);
const loadAudio = (url: string) => {
    audioLoader.loadAudio(url).then(() => togglePause());
}
const toggleSelectFile = () => {
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'audio/*';
    file.onchange = (e) => {
        musicFile.value = (e.target as HTMLInputElement).files?.[0] || null;
        if (musicFile.value) musicFileUrl.value = URL.createObjectURL(musicFile.value);
        if (musicFileUrl.value) loadAudio(musicFileUrl.value);
        getAudioInfo();
    };
    file.click();
};

const albumCover = ref<string>('/default_cover.png');
const albumInfo = ref<{
    fileName: string;
    title: string;
    artist: string;
    duration: string;
}>({
    fileName: 'unknown file',
    title: 'unknown title',
    artist: 'unknown artist',
    duration: '00:00',
});
//获取音频信息
const getAudioInfo = async () => {
    if (musicFile.value) {
        await parseBlob(musicFile.value).then(metadata => {
            albumInfo.value = {
                fileName: musicFile.value?.name || 'unknown',
                title: metadata.common.title || 'unknown',
                artist: metadata.common.artist || 'unknown',
                duration: formatSecToTime(metadata.format.duration || 0),
            };
            const cover = metadata.common.picture?.[0] || null;
            if (cover) {
                const blob = new Blob([cover.data as BlobPart], { type: 'image/png' });
                albumCover.value = URL.createObjectURL(blob);
            }
        });
    }
}

//实时音频响应
let raiseSpeed = 0.5;
let fallSpeed = 0.05;
let previousEnergy = 0;
const toggleRealTime = () => {
    let rafId: number | null = null;
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

            // console.log(features);
            const processElement = document.getElementById('music-bar-container');
            processElement?.setAttribute(
                'style',
                `--coinc-process: ${mapEnergyToDeg(previousEnergy)}deg;`);
            toggleRealTime();
        });
    } else {
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
    albumInfo.value.fileName,
    albumInfo.value.title,
    albumInfo.value.artist,
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
            if (!textEl) {
                next.push(false);
                return;
            }
            next.push(textEl.scrollWidth > wrap.clientWidth);
        });
        shouldMarquee.value = next;
        nextTick(() => {
            wraps.forEach((wrap, idx) => {
                if (!shouldMarquee.value[idx]) return;
                const track = wrap.querySelector('.info-marquee-track') as HTMLElement | null;
                if (!track) return;
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

watch(albumInfo, () => setupInfoMarquee(), { deep: true });

/** 拖动进度条 */
let progressWidthPercent = 0;
const updateProgressWidthPercent = (e: MouseEvent) => {
    const progressBar = document.getElementById('progress-bar-container');
    if (progressBar) {
        const progressBarWidth = progressBar.clientWidth;
        let temp = (e.clientX - progressBar.getBoundingClientRect().left) / progressBarWidth;
        progressWidthPercent = clamp(temp, 0, 1);
        console.log('progressWidthPercent', progressWidthPercent);
    }
}
const setProgressButton = (percent: number) => {
    const el = document.getElementById('progress-bar-container');
    el?.setAttribute('style', `--progress-width: ${percent * 100}%`);
}
const setProgressTime = (percent: number) => {
    if (!audioLoader) return;
    audioLoader.setPlaybackOffsetPercent(percent);
}
const handleDragStart = (e: MouseEvent) => {
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    togglePause();
    updateProgressWidthPercent(e);
    setProgressButton(progressWidthPercent);
    console.log('拖动开始', e);
}
const handleDragMove = (e: MouseEvent) => {
    updateProgressWidthPercent(e);
    setProgressButton(progressWidthPercent);
}
const handleDragEnd = (e: MouseEvent) => {
    console.log('拖动结束', e);
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    setProgressTime(progressWidthPercent);
    togglePause();
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
</style>