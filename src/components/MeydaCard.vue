<template>
    <article
        class="analysis-card"
        :data-feature-id="featureId"
        :aria-labelledby="`${cardId}-title`"
    >
        <header class="card-header">
            <div>
                <p class="eyebrow">{{ definition.outputShape }}</p>
                <h2 :id="`${cardId}-title`">{{ definition.label }}</h2>
            </div>
            <div class="card-actions">
                <label :for="`${cardId}-feature`" class="sr-only">
                    替换分析特征
                </label>
                <select
                    :id="`${cardId}-feature`"
                    :value="featureId"
                    aria-label="替换分析特征"
                    @change="handleFeatureChange"
                >
                    <option
                        v-for="option in featureOptions"
                        :key="option.id"
                        :value="option.id"
                        :disabled="
                            option.id !== featureId
                            && disabledFeatureIds.includes(option.id)
                        "
                    >
                        {{ option.label }}
                    </option>
                </select>
                <button type="button" @click="$emit('remove')">
                    移除
                </button>
            </div>
        </header>

        <p class="description">{{ definition.description }}</p>

        <div
            ref="plotElement"
            class="plot"
            role="application"
            tabindex="0"
            :aria-label="`${definition.label} 共享时间轴图表。点击或使用方向键定位播放游标。`"
            @click="handlePlotClick"
            @keydown="handlePlotKeydown"
        >
            <canvas ref="staticCanvas" aria-hidden="true"></canvas>
            <canvas ref="cursorCanvas" aria-hidden="true"></canvas>
            <div v-if="!series && !rendererError" class="plot-message">
                <span v-if="analysisState === 'error'">
                    分析暂不可用，请使用下方重试。
                </span>
                <span v-else-if="analysisState === 'cancelled'">
                    分析已取消。
                </span>
                <span v-else>
                    {{ analysisState === 'ready' ? '等待此卡数据…' : '正在准备分析…' }}
                </span>
            </div>
            <div v-if="rendererError" class="plot-message plot-error">
                <p>{{ rendererError }}</p>
                <button type="button" @click.stop="retryRenderer">
                    重试此卡
                </button>
            </div>
        </div>

        <div class="axis-summary" aria-hidden="true">
            <span>{{ formatTime(viewport.startSeconds) }}</span>
            <span v-if="featureId === 'amplitudeSpectrum'">
                0 – {{ formatFrequency(nyquist) }}
            </span>
            <span v-else-if="featureId === 'chroma'">C – B</span>
            <span v-else>{{ scalarAxisLabel }}</span>
            <span>{{ formatTime(viewport.endSeconds) }}</span>
        </div>

        <dl class="facts">
            <div>
                <dt>Frame</dt>
                <dd>{{ frameTimeLabel }}</dd>
            </div>
            <div>
                <dt>参数</dt>
                <dd>1024 frame / 512 hop / Hanning</dd>
            </div>
            <div v-if="definition.outputShape === 'scalar'">
                <dt>精确值</dt>
                <dd>{{ scalarExactLabel }}</dd>
            </div>
            <div v-else-if="featureId === 'amplitudeSpectrum'">
                <dt>峰值</dt>
                <dd>{{ amplitudePeakLabel }}</dd>
            </div>
            <div v-else>
                <dt>主音级</dt>
                <dd>{{ chromaPeakLabel }}</dd>
            </div>
        </dl>

        <details v-if="featureId === 'amplitudeSpectrum'" class="value-table">
            <summary>查看完整频率 bin 精确值（{{ exactVector.length }}）</summary>
            <div class="table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Bin</th>
                            <th scope="col">Hz</th>
                            <th scope="col">Amplitude</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(value, index) in exactVector" :key="index">
                            <th scope="row">{{ index }}</th>
                            <td>{{ formatFrequency(binFrequency(index)) }}</td>
                            <td>{{ formatValue(value) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </details>

        <div v-if="featureId === 'chroma'" class="value-table">
            <p class="table-title">12 音级精确值</p>
            <div class="table-scroll compact">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">音级</th>
                            <th scope="col">强度</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(label, index) in CHROMA_LABELS" :key="label">
                            <th scope="row">{{ label }}</th>
                            <td>{{ formatValue(exactVector[index]) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </article>
</template>

<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from 'vue';
import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import {
    cursorSampleIndex,
    peakBin,
    scalarPlotDomain,
    vectorAt,
    visibleSampleRange,
} from '../analysis/rendererData';
import {
    canvasXToTime,
    timeToCanvasX,
} from '../analysis/timelineViewport';
import {
    M8_AVAILABLE_FEATURE_IDS,
    type AnalysisCoordinatorState,
    type AnalysisCursorValueResult,
    type AnalysisSeries,
    type M8FeatureId,
} from '../analysis/types';
import type { PersistedTimelineViewport } from '../types/session';

const CHROMA_LABELS = [
    'C', 'C♯', 'D', 'D♯', 'E', 'F',
    'F♯', 'G', 'G♯', 'A', 'A♯', 'B',
] as const;

const props = defineProps<{
    slot: 0 | 1 | 2 | 3;
    featureId: M8FeatureId;
    disabledFeatureIds: readonly M8FeatureId[];
    series: AnalysisSeries | null;
    viewport: PersistedTimelineViewport;
    cursorSeconds: number;
    durationSeconds: number;
    sampleRate: number | null;
    exactValue: AnalysisCursorValueResult | null;
    analysisState: AnalysisCoordinatorState;
}>();

const emit = defineEmits<{
    change: [featureId: M8FeatureId];
    remove: [];
    seek: [seconds: number];
}>();

const staticCanvas = ref<HTMLCanvasElement | null>(null);
const cursorCanvas = ref<HTMLCanvasElement | null>(null);
const plotElement = ref<HTMLElement | null>(null);
const rendererError = ref<string | null>(null);
const renderRevision = ref(0);
let resizeObserver: ResizeObserver | null = null;

const cardId = computed(() => `analysis-card-${props.slot}`);
const definition = computed(() => FEATURE_REGISTRY[props.featureId]);
const featureOptions = M8_AVAILABLE_FEATURE_IDS.map((id) => ({
    id,
    label: FEATURE_REGISTRY[id].label,
}));
const nyquist = computed(() => (props.sampleRate ?? 0) / 2);
const exactVector = computed<number[]>(() =>
    Array.isArray(props.exactValue?.value)
        ? props.exactValue.value
        : []);
const frameTimeLabel = computed(() =>
    props.exactValue
        ? formatTime(props.exactValue.frameStartSeconds)
        : '等待精确帧');
const scalarExactLabel = computed(() =>
    typeof props.exactValue?.value === 'number'
        ? `${formatValue(props.exactValue.value)}${
            definition.value.range.unit
                ? ` ${definition.value.range.unit}`
                : ''
        }`
        : '—');
const scalarAxisLabel = computed(() => {
    const range = definition.value.range;
    const bounds = range.min !== undefined && range.max !== undefined
        ? `${range.min} – ${range.max}`
        : range.signed
            ? 'signed · zero line'
            : 'zero baseline';
    return `${definition.value.label} · ${bounds}${
        range.unit ? ` ${range.unit}` : ''
    }`;
});
const amplitudePeak = computed(() => peakBin(exactVector.value));
const amplitudePeakLabel = computed(() => {
    if (exactVector.value.length === 0) return '—';
    return `${formatFrequency(binFrequency(amplitudePeak.value.index))}
        / ${formatValue(amplitudePeak.value.value)}`;
});
const chromaPeakLabel = computed(() => {
    if (exactVector.value.length === 0) return '—';
    const peak = peakBin(exactVector.value);
    return `${CHROMA_LABELS[peak.index] ?? '—'} / ${formatValue(peak.value)}`;
});

const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds)) return '0:00.000';
    const safe = Math.max(0, seconds);
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${(safe % 60).toFixed(3).padStart(6, '0')}`;
};

const formatValue = (value: number | undefined): string =>
    Number.isFinite(value) ? Number(value).toPrecision(6) : '—';

const formatFrequency = (hertz: number): string =>
    hertz >= 1000
        ? `${(hertz / 1000).toFixed(2)} kHz`
        : `${Math.max(0, hertz).toFixed(1)} Hz`;

const binFrequency = (index: number): number =>
    props.sampleRate
        ? index * props.sampleRate / 1024
        : 0;

const handleFeatureChange = (event: Event) => {
    const value = (event.target as HTMLSelectElement).value;
    if ((M8_AVAILABLE_FEATURE_IDS as readonly string[]).includes(value)) {
        emit('change', value as M8FeatureId);
    }
};

const handlePlotClick = (event: MouseEvent) => {
    const rect = plotElement.value?.getBoundingClientRect();
    if (!rect) return;
    emit(
        'seek',
        canvasXToTime(event.clientX - rect.left, props.viewport, rect.width),
    );
};

const handlePlotKeydown = (event: KeyboardEvent) => {
    const span = props.viewport.endSeconds - props.viewport.startSeconds;
    const step = Math.max(0.05, Math.min(1, span / 20));
    let target: number | null = null;
    if (event.key === 'ArrowLeft') {
        target = props.cursorSeconds - step;
    } else if (event.key === 'ArrowRight') {
        target = props.cursorSeconds + step;
    } else if (event.key === 'Home') {
        target = 0;
    } else if (event.key === 'End') {
        target = props.durationSeconds;
    }
    if (target === null) return;
    event.preventDefault();
    emit('seek', Math.max(0, Math.min(props.durationSeconds, target)));
};

const prepareCanvas = (
    canvas: HTMLCanvasElement,
): CanvasRenderingContext2D => {
    const element = plotElement.value;
    if (!element) throw new Error('图表容器尚未准备好。');
    const rect = element.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器未提供 Canvas 2D context。');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    return context;
};

const canvasSize = () => {
    const rect = plotElement.value?.getBoundingClientRect();
    return {
        width: Math.max(1, Math.round(rect?.width ?? 1)),
        height: Math.max(1, Math.round(rect?.height ?? 1)),
    };
};

const drawGrid = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
) => {
    context.fillStyle = '#07100c';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(132, 255, 185, 0.12)';
    context.lineWidth = 1;
    for (let index = 1; index < 5; index += 1) {
        const x = width * index / 5;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
    }
    for (let index = 1; index < 4; index += 1) {
        const y = height * index / 4;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
    }
};

const drawScalar = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    series: AnalysisSeries,
) => {
    if (series.payload.kind !== 'scalar-f32') {
        throw new Error('标量数据形态与 renderer 不匹配。');
    }
    const range = visibleSampleRange(series, props.viewport);
    const values = series.payload.values.subarray(
        range.startIndex,
        range.endIndex,
    );
    const domain = scalarPlotDomain(values, definition.value.range);
    const toY = (value: number) => height - 6
        - (value - domain.min) / (domain.max - domain.min) * (height - 12);
    if (definition.value.range.signed) {
        const zeroY = toY(0);
        context.strokeStyle = 'rgba(248, 255, 135, 0.45)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, zeroY + 0.5);
        context.lineTo(width, zeroY + 0.5);
        context.stroke();
    }
    context.strokeStyle = '#7dffb3';
    context.lineWidth = 2;
    context.beginPath();
    values.forEach((value, localIndex) => {
        const sampleIndex = range.startIndex + localIndex;
        const x = timeToCanvasX(
            sampleIndex * series.sampleStepSeconds,
            props.viewport,
            width,
        );
        const y = toY(value);
        if (localIndex === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    });
    context.stroke();
};

const heatColor = (value: number, maximum: number): string => {
    const intensity = maximum <= 0
        ? 0
        : Math.sqrt(Math.max(0, value) / maximum);
    const hue = 155 - intensity * 80;
    const lightness = 8 + intensity * 62;
    return `hsl(${hue} 90% ${lightness}%)`;
};

const drawHeatmap = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    series: AnalysisSeries,
) => {
    if (
        series.payload.kind !== 'frequency-u16'
        && series.payload.kind !== 'category-u16'
    ) {
        throw new Error('向量数据形态与 renderer 不匹配。');
    }
    const payload = series.payload;
    const range = visibleSampleRange(series, props.viewport);
    const topHeight = Math.floor(height * 0.7);
    const sampleCount = Math.max(1, range.endIndex - range.startIndex);
    const columns = Math.max(1, Math.min(width, sampleCount));
    const rows = payload.kind === 'category-u16'
        ? payload.width
        : Math.min(128, payload.width);
    let maximum = 0;
    for (let index = 0; index < payload.values.length; index += 1) {
        maximum = Math.max(
            maximum,
            (payload.values[index] ?? 0) * payload.scale + payload.offset,
        );
    }
    for (let column = 0; column < columns; column += 1) {
        const sampleIndex = Math.min(
            range.endIndex - 1,
            range.startIndex + Math.floor(column * sampleCount / columns),
        );
        const values = vectorAt(payload, sampleIndex);
        const x0 = Math.floor(column * width / columns);
        const x1 = Math.ceil((column + 1) * width / columns);
        for (let row = 0; row < rows; row += 1) {
            const bin = payload.kind === 'category-u16'
                ? row
                : Math.min(
                    payload.width - 1,
                    Math.floor(row * payload.width / rows),
                );
            context.fillStyle = heatColor(values[bin] ?? 0, maximum);
            const y = topHeight - Math.ceil((row + 1) * topHeight / rows);
            context.fillRect(
                x0,
                y,
                Math.max(1, x1 - x0),
                Math.ceil(topHeight / rows) + 1,
            );
        }
    }
    context.strokeStyle = 'rgba(132, 255, 185, 0.35)';
    context.beginPath();
    context.moveTo(0, topHeight + 0.5);
    context.lineTo(width, topHeight + 0.5);
    context.stroke();
};

const cursorVector = (): number[] => {
    if (exactVector.value.length > 0) return exactVector.value;
    const series = props.series;
    if (
        !series
        || (
            series.payload.kind !== 'frequency-u16'
            && series.payload.kind !== 'category-u16'
        )
    ) {
        return [];
    }
    return vectorAt(
        series.payload,
        cursorSampleIndex(series, props.cursorSeconds),
    );
};

const drawStatic = () => {
    const canvas = staticCanvas.value;
    if (!canvas) return;
    const context = prepareCanvas(canvas);
    const { width, height } = canvasSize();
    drawGrid(context, width, height);
    if (!props.series) return;
    if (definition.value.outputShape === 'scalar') {
        drawScalar(context, width, height, props.series);
    } else {
        drawHeatmap(context, width, height, props.series);
    }
};

const drawCursor = () => {
    const canvas = cursorCanvas.value;
    if (!canvas) return;
    const context = prepareCanvas(canvas);
    const { width, height } = canvasSize();
    const x = timeToCanvasX(
        props.cursorSeconds,
        props.viewport,
        width,
    );
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
    if (definition.value.outputShape === 'scalar') return;
    const values = cursorVector();
    if (values.length === 0) return;
    const baseline = Math.floor(height * 0.72);
    const chartHeight = height - baseline - 6;
    const maximum = Math.max(0.000001, ...values);
    if (props.featureId === 'chroma') {
        const barWidth = width / values.length;
        values.forEach((value, index) => {
            const barHeight = chartHeight * Math.max(0, value) / maximum;
            context.fillStyle = '#7dffb3';
            context.fillRect(
                index * barWidth + 1,
                height - barHeight - 3,
                Math.max(1, barWidth - 2),
                barHeight,
            );
        });
        return;
    }
    context.strokeStyle = '#7dffb3';
    context.lineWidth = 1.5;
    context.beginPath();
    values.forEach((value, index) => {
        const px = values.length <= 1
            ? 0
            : index / (values.length - 1) * width;
        const py = height - 3 - Math.max(0, value) / maximum * chartHeight;
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
    });
    context.stroke();
};

const render = async () => {
    await nextTick();
    try {
        drawStatic();
        drawCursor();
        rendererError.value = null;
    } catch (error) {
        rendererError.value = error instanceof Error
            ? error.message
            : '此卡 renderer 出错。';
    }
};

const retryRenderer = () => {
    renderRevision.value += 1;
    void render();
};

watch(
    () => [
        props.series,
        props.viewport.startSeconds,
        props.viewport.endSeconds,
        props.viewport.zoom,
        props.featureId,
        renderRevision.value,
    ],
    () => void render(),
    { deep: false },
);

watch(
    () => [props.cursorSeconds, props.exactValue],
    () => {
        try {
            drawCursor();
        } catch (error) {
            rendererError.value = error instanceof Error
                ? error.message
                : '游标层 renderer 出错。';
        }
    },
    { deep: false },
);

onMounted(() => {
    resizeObserver = new ResizeObserver(() => void render());
    if (plotElement.value) resizeObserver.observe(plotElement.value);
    void render();
});

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
});
</script>

<style scoped>
.analysis-card {
    border: 1px solid rgba(125, 255, 179, 0.24);
    border-radius: 18px;
    background: rgba(4, 10, 7, 0.9);
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.34);
    color: #f2fff7;
    min-width: 0;
    padding: 18px;
}

.card-header,
.card-actions,
.axis-summary,
.facts {
    display: flex;
    align-items: center;
}

.card-header {
    justify-content: space-between;
    gap: 16px;
}

.card-header h2 {
    font-size: 1.15rem;
    font-weight: 680;
    letter-spacing: -0.02em;
    margin: 2px 0 0;
}

.eyebrow {
    color: #7dffb3;
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    margin: 0;
    text-transform: uppercase;
}

.card-actions {
    gap: 8px;
}

select,
button {
    border: 1px solid rgba(125, 255, 179, 0.34);
    border-radius: 9px;
    background: #0b1710;
    color: #effff5;
    font: inherit;
    font-size: 0.78rem;
    min-height: 34px;
    padding: 6px 9px;
    transition:
        background-color 120ms ease,
        border-color 120ms ease,
        box-shadow 120ms ease,
        color 120ms ease,
        transform 80ms ease;
}

button {
    cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
    button:hover,
    select:hover {
        background: #10261a;
        border-color: #7dffb3;
    }
}

button:active:not(:disabled) {
    background: #173624;
    border-color: #b5ffd2;
    box-shadow: inset 0 0 0 1px rgba(181, 255, 210, 0.3);
    transform: translateY(1px);
}

button:focus-visible,
select:focus-visible,
.plot:focus-visible {
    outline: 3px solid #f8ff87;
    outline-offset: 3px;
}

button:focus:not(:focus-visible),
select:focus:not(:focus-visible) {
    outline: none;
}

.description {
    color: #abc1b3;
    font-size: 0.8rem;
    line-height: 1.55;
    margin: 12px 0;
    min-height: 2.5em;
}

.plot {
    border: 1px solid rgba(125, 255, 179, 0.18);
    border-radius: 12px;
    cursor: crosshair;
    height: 250px;
    overflow: hidden;
    position: relative;
}

.plot canvas {
    inset: 0;
    position: absolute;
}

.plot-message {
    align-items: center;
    background: rgba(4, 10, 7, 0.82);
    color: #abc1b3;
    display: flex;
    flex-direction: column;
    gap: 12px;
    inset: 0;
    justify-content: center;
    padding: 20px;
    position: absolute;
    text-align: center;
}

.plot-error {
    color: #ffd6d6;
}

.axis-summary {
    color: #789284;
    font-size: 0.68rem;
    justify-content: space-between;
    margin-top: 7px;
}

.facts {
    align-items: stretch;
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 14px 0 0;
}

.facts div {
    background: rgba(125, 255, 179, 0.06);
    border-radius: 9px;
    min-width: 0;
    padding: 9px;
}

.facts dt {
    color: #789284;
    font-size: 0.66rem;
    text-transform: uppercase;
}

.facts dd {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    margin: 4px 0 0;
    overflow-wrap: anywhere;
}

.value-table {
    border-top: 1px solid rgba(125, 255, 179, 0.15);
    color: #abc1b3;
    font-size: 0.75rem;
    margin-top: 14px;
    padding-top: 12px;
}

.value-table summary {
    cursor: pointer;
}

.table-title {
    margin: 0 0 8px;
}

.table-scroll {
    max-height: 220px;
    overflow: auto;
    scrollbar-color: rgba(125, 255, 179, 0.65) rgba(5, 17, 11, 0.9);
    scrollbar-gutter: stable;
    scrollbar-width: thin;
}

.table-scroll::-webkit-scrollbar {
    height: 10px;
    width: 10px;
}

.table-scroll::-webkit-scrollbar-track {
    background: rgba(5, 17, 11, 0.9);
    border-radius: 999px;
}

.table-scroll::-webkit-scrollbar-thumb {
    background: rgba(125, 255, 179, 0.58);
    background-clip: padding-box;
    border: 2px solid transparent;
    border-radius: 999px;
}

.table-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(181, 255, 210, 0.82);
    background-clip: padding-box;
}

.table-scroll.compact {
    max-height: 170px;
}

table {
    border-collapse: collapse;
    margin-top: 8px;
    width: 100%;
}

th,
td {
    border-bottom: 1px solid rgba(125, 255, 179, 0.1);
    padding: 6px;
    text-align: right;
}

th:first-child,
td:first-child {
    text-align: left;
}

.sr-only {
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
    width: 1px;
    clip: rect(0, 0, 0, 0);
}

@media (max-width: 720px) {
    .card-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .facts {
        grid-template-columns: 1fr;
    }
}

@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.001ms !important;
    }
}
</style>
