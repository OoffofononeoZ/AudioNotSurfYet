<template>
    <div ref="container" class="chart-container"></div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';

interface Props {
    data: number[]
    name: string
    chartStyle?: 'center' | 'end'
    progress?: number
    range?: [number, number]
}

const props = withDefaults(defineProps<Props>(), {
    progress: 0,
    range: () => [0, 1],
    chartStyle: 'end'
});

const container = ref<HTMLDivElement | null>(null);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.OrthographicCamera(-400, 400, 150, -150, 0.1, 1000);
camera.position.z = 20;

const renderer = new THREE.WebGLRenderer({ antialias: true });

const barGroup = new THREE.Group();
scene.add(barGroup);

let axisLine: THREE.Line | null = null;
let progressLine: THREE.Line | null = null;
let rafId = 0;

const X_STEP = 2;
const BAR_WIDTH_RATIO = 0.8;
const MIN_BAR_HEIGHT = 0.5;
const MIN_VIEW_WIDTH = 80;
const PROGRESS_SCREEN_LIMIT = 0.3;

let viewportHeight = 300;
let viewportWidth = 800;
let zoomScale = 1;
let worldWidth = 0;

const styleMode = computed<'center' | 'end'>(() => {
    // 兼容旧字段 lineStyle，同时支持需求中的可选字符串样式
    const raw = (props.chartStyle ?? 'end').toLowerCase();
    return raw === 'center' ? 'center' : 'end';
});

const safeRange = computed<[number, number]>(() => {
    const [a, b] = props.range ?? [0, 1];
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) {
        return [0, 1];
    }
    return a < b ? [a, b] : [b, a];
});

const safeProgress = computed(() => clamp(props.progress ?? 0, 0, 1));

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getWorldHeight() {
    return Math.max(120, viewportHeight);
}

function mapValueToY(value: number, rangeMin: number, rangeMax: number) {
    const worldHeight = getWorldHeight();
    // 将取值范围线性映射到竖轴可视区间
    const t = clamp((value - rangeMin) / (rangeMax - rangeMin), 0, 1);
    return -worldHeight / 2 + t * worldHeight;
}

function clearBars() {
    for (const child of [...barGroup.children]) {
        barGroup.remove(child);
        const mesh = child as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
        mesh.geometry.dispose();
        mesh.material.dispose();
    }
}

function rebuildBars() {
    clearBars();
    const [min, max] = safeRange.value;
    worldWidth = props.data.length * X_STEP;

    for (let i = 0; i < props.data.length; i += 1) {
        const rawValue = props.data[i] ?? 0;
        const value = Number.isFinite(rawValue) ? rawValue : 0;
        const x = i * X_STEP + X_STEP / 2;

        let centerY = 0;
        let barHeight = MIN_BAR_HEIGHT;

        if (styleMode.value === 'center') {
            // center: 围绕中轴线(0轴)对称展开
            const yValue = mapValueToY(value, min, max);
            barHeight = Math.max(Math.abs(yValue), MIN_BAR_HEIGHT);
            centerY = yValue / 2;
        } else {
            // end 模式下以 0 轴为基线，柱子向上下扩展
            const zeroY = mapValueToY(0, min, max);
            const valueY = mapValueToY(value, min, max);
            barHeight = Math.max(Math.abs(valueY - zeroY), MIN_BAR_HEIGHT);
            centerY = (valueY + zeroY) / 2;
        }

        const geometry = new THREE.PlaneGeometry(X_STEP * BAR_WIDTH_RATIO, barHeight);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, centerY, 0);
        barGroup.add(mesh);
    }
}

function disposeLine(line: THREE.Line | null) {
    if (!line) {
        return;
    }
    scene.remove(line);
    line.geometry.dispose();
    (line.material as THREE.LineBasicMaterial).dispose();
}

function rebuildAxisLine() {
    disposeLine(axisLine);
    const worldHeight = getWorldHeight();
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -worldHeight / 2, 1),
        new THREE.Vector3(0, worldHeight / 2, 1)
    ]);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    axisLine = new THREE.Line(geometry, material);
    scene.add(axisLine);
}

function rebuildProgressLine() {
    disposeLine(progressLine);
    const worldHeight = getWorldHeight();
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -worldHeight / 2, 2),
        new THREE.Vector3(0, worldHeight / 2, 2)
    ]);
    const material = new THREE.LineBasicMaterial({ color: 0xff3366 });
    progressLine = new THREE.Line(geometry, material);
    scene.add(progressLine);
}

function getMaxViewWidth() {
    return Math.max(worldWidth, viewportWidth);
}

function applyProjection() {
    const worldHeight = getWorldHeight();
    // 只修改 left/right 宽度实现横向缩放，top/bottom 仅随容器高度变化
    camera.left = -viewportWidth / 2;
    camera.right = viewportWidth / 2;
    camera.top = worldHeight / 2;
    camera.bottom = -worldHeight / 2;
    camera.updateProjectionMatrix();
}

function updateProgressAndCamera() {
    if (!progressLine) {
        return;
    }
    const progressX = safeProgress.value * worldWidth;
    progressLine.position.x = progressX;

    // 通过移动相机中心，让进度线在屏幕中最多保持在 30% 位置
    const desiredLeft = progressX - viewportWidth * PROGRESS_SCREEN_LIMIT;
    const maxLeft = Math.max(0, worldWidth - viewportWidth);
    const clampedLeft = clamp(desiredLeft, 0, maxLeft);
    camera.position.x = clampedLeft + viewportWidth / 2;
    camera.position.y = 0;
}

function rebuildChartObjects() {
    rebuildBars();
    rebuildAxisLine();
    rebuildProgressLine();
    viewportWidth = clamp(viewportWidth, MIN_VIEW_WIDTH, getMaxViewWidth());
    applyProjection();
    updateProgressAndCamera();
}

function animate() {
    rafId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function resizeRenderer() {
    if (!container.value) {
        return;
    }
    const width = Math.max(container.value.clientWidth, 200);
    const height = Math.max(container.value.clientHeight, 120);
    viewportHeight = height;
    renderer.setSize(width, height);

    const maxViewWidth = getMaxViewWidth();
    const desiredWidth = width * zoomScale;
    viewportWidth = clamp(desiredWidth, MIN_VIEW_WIDTH, maxViewWidth);
    applyProjection();
    updateProgressAndCamera();
}

function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomMultiplier = e.deltaY > 0 ? 1.1 : 1 / 1.1;
    zoomScale = clamp(zoomScale * zoomMultiplier, 0.1, 20);
    const maxViewWidth = getMaxViewWidth();
    const desiredWidth = Math.max((container.value?.clientWidth ?? 800) * zoomScale, MIN_VIEW_WIDTH);
    viewportWidth = clamp(desiredWidth, MIN_VIEW_WIDTH, maxViewWidth);
    applyProjection();
    updateProgressAndCamera();
}

onMounted(() => {
    if (!container.value) {
        return;
    }
    container.value.appendChild(renderer.domElement);
    resizeRenderer();
    rebuildChartObjects();
    container.value.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', resizeRenderer);
    animate();
});

onBeforeUnmount(() => {
    if (container.value) {
        container.value.removeEventListener('wheel', handleWheel);
    }
    window.removeEventListener('resize', resizeRenderer);
    cancelAnimationFrame(rafId);
    clearBars();
    disposeLine(axisLine);
    disposeLine(progressLine);
    renderer.dispose();
});

watch(
    () => [props.data, props.range, styleMode.value] as const,
    () => {
        rebuildChartObjects();
    },
    { deep: true }
);

watch(
    () => props.progress,
    () => {
        updateProgressAndCamera();
    }
);
</script>

<style scoped>
.chart-container {
    width: calc(100% - 200px);
    height: 300px;
    overflow: hidden;
}
</style>