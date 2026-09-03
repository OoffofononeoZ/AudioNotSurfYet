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
                <slot name="header-action"></slot>
                <button
                    type="button"
                    class="toggle-card"
                    :aria-expanded="expanded"
                    :aria-controls="bodyId"
                    @click="$emit('toggle')"
                >
                    {{ expanded ? '收起分析' : '展开分析' }}
                </button>
            </div>
        </header>

        <p class="description">{{ definition.description }}</p>

        <div v-if="expanded" :id="bodyId" class="card-body">
            <div
                ref="plotElement"
                class="plot"
                :class="{ 'plot-structured': isStructuredFeature }"
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
            <span v-if="isSpectrumFeature">
                0 – {{ formatFrequency(nyquist) }}
            </span>
            <span v-else-if="featureId === 'loudness'">
                B0 – B23 · total zero baseline
            </span>
            <span v-else-if="featureId === 'complexSpectrum'">
                bins 0–1023 · +Hz / −Hz mirror · phase −π…π
            </span>
            <span v-else-if="featureId === 'chroma'">C – B</span>
            <span v-else-if="featureId === 'mfcc'">C0 – C12 · signed</span>
            <span v-else-if="featureId === 'buffer'">−1 – 1 · zero line</span>
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
                <dd>{{ parameterLabel }}</dd>
            </div>
            <div v-if="definition.outputShape === 'scalar'">
                <dt>精确值</dt>
                <dd>{{ scalarExactLabel }}</dd>
            </div>
            <div v-else-if="isSpectrumFeature">
                <dt>峰值</dt>
                <dd>{{ spectrumPeakLabel }}</dd>
            </div>
            <div v-else-if="featureId === 'chroma'">
                <dt>主音级</dt>
                <dd>{{ chromaPeakLabel }}</dd>
            </div>
            <div v-else-if="featureId === 'mfcc'">
                <dt>最强系数</dt>
                <dd>{{ mfccPeakLabel }}</dd>
            </div>
            <div v-else-if="featureId === 'buffer'">
                <dt>帧范围</dt>
                <dd>{{ bufferRangeLabel }}</dd>
            </div>
            <div v-else-if="featureId === 'loudness'">
                <dt>总响度</dt>
                <dd>{{ loudnessTotalLabel }}</dd>
            </div>
            <div v-else-if="featureId === 'complexSpectrum'">
                <dt>最强 bin</dt>
                <dd>{{ complexPeakLabel }}</dd>
            </div>
            <div v-if="featureId === 'buffer'">
                <dt>尾帧</dt>
                <dd>{{ bufferPaddingLabel }}</dd>
            </div>
            <div v-if="featureId === 'loudness'">
                <dt>最强 Bark band</dt>
                <dd>{{ loudnessBandLabel }}</dd>
            </div>
            <div v-if="featureId === 'complexSpectrum'">
                <dt>峰值相位</dt>
                <dd>{{ complexPeakPhaseLabel }}</dd>
            </div>
        </dl>

        <details v-if="isSpectrumFeature" class="value-table">
            <summary>
                查看完整频率 bin 精确值（{{ exactVector.length }}）
            </summary>
            <div class="table-scroll app-scrollbar">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Bin</th>
                            <th scope="col">Hz</th>
                            <th scope="col">{{ spectrumValueHeading }}</th>
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

        <details v-if="featureId === 'mfcc'" class="value-table">
            <summary>查看 13 项 MFCC 精确值（{{ exactVector.length }}）</summary>
            <div class="table-scroll compact app-scrollbar">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">系数</th>
                            <th scope="col">精确值</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(value, index) in exactVector" :key="index">
                            <th scope="row">C{{ index }}</th>
                            <td>{{ formatValue(value) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </details>

        <details v-if="featureId === 'buffer'" class="value-table">
            <summary>
                查看当前 Buffer frame 精确值（{{ exactVector.length }}）
            </summary>
            <div class="table-scroll app-scrollbar">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Sample</th>
                            <th scope="col">Amplitude</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(value, index) in exactVector" :key="index">
                            <th scope="row">{{ index }}</th>
                            <td>{{ formatValue(value) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </details>

        <details v-if="featureId === 'loudness'" class="value-table">
            <summary>
                查看 24 个 Bark band 精确值（{{ exactLoudness.specific.length }}）
            </summary>
            <div class="table-scroll compact app-scrollbar">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Band</th>
                            <th scope="col">Specific loudness</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="(value, index) in exactLoudness.specific"
                            :key="index"
                        >
                            <th scope="row">B{{ index }}</th>
                            <td>{{ formatValue(value) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </details>

        <details v-if="featureId === 'complexSpectrum'" class="value-table">
            <summary>
                查看完整 Complex Spectrum 精确值（{{ complexRows.length }}）
            </summary>
            <div class="table-scroll complex-table app-scrollbar">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Bin</th>
                            <th scope="col">Signed Hz</th>
                            <th scope="col">Real</th>
                            <th scope="col">Imag</th>
                            <th scope="col">Magnitude</th>
                            <th scope="col">Phase</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="entry in complexRows" :key="entry.index">
                            <th scope="row">{{ entry.index }}</th>
                            <td>{{ formatSignedFrequency(entry.frequency) }}</td>
                            <td>{{ formatValue(entry.real) }}</td>
                            <td>{{ formatValue(entry.imag) }}</td>
                            <td>{{ formatValue(entry.magnitude) }}</td>
                            <td>{{ entry.phaseLabel }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </details>

        <div v-if="featureId === 'chroma'" class="value-table">
            <p class="table-title">12 音级精确值</p>
            <div class="table-scroll compact app-scrollbar">
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
    peakBin,
    signedFftBinFrequency,
} from '../analysis/rendererData';
import { canvasXToTime } from '../analysis/timelineViewport';
import {
    analysisCanvasRenderer,
    prepareCanvasSurface,
    type EditorRenderRequest,
} from '../analysis/canvasRenderer';
import {
    type AnalysisCoordinatorState,
    type AnalysisCursorValueResult,
    type AnalysisSeries,
    type M10FeatureId,
} from '../analysis/types';
import type { PersistedTimelineViewport } from '../types/session';

const CHROMA_LABELS = [
    'C', 'C♯', 'D', 'D♯', 'E', 'F',
    'F♯', 'G', 'G♯', 'A', 'A♯', 'B',
] as const;

const props = defineProps<{
    featureId: M10FeatureId;
    expanded: boolean;
    series: AnalysisSeries | null;
    viewport: PersistedTimelineViewport;
    cursorSeconds: number;
    durationSeconds: number;
    sampleRate: number | null;
    exactValue: AnalysisCursorValueResult | null;
    analysisState: AnalysisCoordinatorState;
}>();

const emit = defineEmits<{
    toggle: [];
    seek: [seconds: number];
}>();

const staticCanvas = ref<HTMLCanvasElement | null>(null);
const cursorCanvas = ref<HTMLCanvasElement | null>(null);
const plotElement = ref<HTMLElement | null>(null);
const rendererError = ref<string | null>(null);
const renderRevision = ref(0);
let resizeObserver: ResizeObserver | null = null;

const cardId = computed(() => `analysis-card-${props.featureId}`);
const bodyId = computed(() => `${cardId.value}-body`);
const definition = computed(() => FEATURE_REGISTRY[props.featureId]);
const nyquist = computed(() => (props.sampleRate ?? 0) / 2);
const isSpectrumFeature = computed(() =>
    props.featureId === 'amplitudeSpectrum'
    || props.featureId === 'powerSpectrum');
const isStructuredFeature = computed(() =>
    props.featureId === 'loudness'
    || props.featureId === 'complexSpectrum');
const spectrumValueHeading = computed(() =>
    props.featureId === 'powerSpectrum' ? 'Power' : 'Amplitude');
const parameterLabel = computed(() => {
    if (props.featureId === 'mfcc') {
        return '1024 frame / 512 hop / Hanning / 13 MFCC';
    }
    if (props.featureId === 'loudness') {
        return '1024 frame / 512 hop / Hanning / 24 Bark bands';
    }
    if (props.featureId === 'complexSpectrum') {
        return '1024 frame / 512 hop / Hanning / full FFT';
    }
    return '1024 frame / 512 hop / Hanning';
});
const exactVector = computed<number[]>(() =>
    Array.isArray(props.exactValue?.value)
        ? props.exactValue.value
        : []);
const exactLoudness = computed<{ total: number; specific: number[] }>(() => {
    const value = props.exactValue?.value;
    if (
        value
        && typeof value === 'object'
        && !Array.isArray(value)
        && 'total' in value
        && 'specific' in value
        && typeof value.total === 'number'
        && Array.isArray(value.specific)
    ) {
        return { total: value.total, specific: value.specific };
    }
    return { total: 0, specific: [] };
});
const exactComplex = computed<{ real: number[]; imag: number[] }>(() => {
    const value = props.exactValue?.value;
    if (
        value
        && typeof value === 'object'
        && !Array.isArray(value)
        && 'real' in value
        && 'imag' in value
        && Array.isArray(value.real)
        && Array.isArray(value.imag)
    ) {
        return { real: value.real, imag: value.imag };
    }
    return { real: [], imag: [] };
});
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
const spectrumPeak = computed(() => peakBin(exactVector.value));
const spectrumPeakLabel = computed(() => {
    if (exactVector.value.length === 0) return '—';
    return `${formatFrequency(binFrequency(spectrumPeak.value.index))}
        / ${formatValue(spectrumPeak.value.value)}`;
});
const mfccPeakLabel = computed(() => {
    if (exactVector.value.length === 0) return '—';
    let index = 0;
    let magnitude = 0;
    exactVector.value.forEach((value, candidateIndex) => {
        if (Math.abs(value) > magnitude) {
            index = candidateIndex;
            magnitude = Math.abs(value);
        }
    });
    return `C${index} / ${formatValue(exactVector.value[index])}`;
});
const bufferRangeLabel = computed(() => {
    if (exactVector.value.length === 0) return '—';
    return `${formatValue(Math.min(...exactVector.value))}
        – ${formatValue(Math.max(...exactVector.value))}`;
});
const bufferPaddingLabel = computed(() => {
    if (
        !props.exactValue
        || !props.sampleRate
        || props.sampleRate <= 0
        || props.durationSeconds <= 0
    ) return '—';
    const frameEnd = props.exactValue.frameStartSeconds + 1024 / props.sampleRate;
    const padded = Math.max(
        0,
        Math.min(
            1024,
            Math.round((frameEnd - props.durationSeconds) * props.sampleRate),
        ),
    );
    return padded > 0 ? `${padded} samples 补 0` : '无补 0';
});
const chromaPeakLabel = computed(() => {
    if (exactVector.value.length === 0) return '—';
    const peak = peakBin(exactVector.value);
    return `${CHROMA_LABELS[peak.index] ?? '—'} / ${formatValue(peak.value)}`;
});
const loudnessTotalLabel = computed(() =>
    exactLoudness.value.specific.length === 24
        ? formatValue(exactLoudness.value.total)
        : '—');
const loudnessPeak = computed(() => peakBin(exactLoudness.value.specific));
const loudnessBandLabel = computed(() =>
    exactLoudness.value.specific.length === 24
        ? `B${loudnessPeak.value.index} / ${formatValue(loudnessPeak.value.value)}`
        : '—');
const complexRows = computed(() => {
    const sampleRate = props.sampleRate ?? 0;
    return exactComplex.value.real.map((real, index) => {
        const imaginary = exactComplex.value.imag[index] ?? 0;
        const magnitude = Math.hypot(real, imaginary);
        const phase = magnitude === 0
            ? null
            : Math.atan2(imaginary, real);
        return {
            index,
            frequency: signedFftBinFrequency(index, 1024, sampleRate),
            real,
            imag: imaginary,
            magnitude,
            phase,
            phaseLabel: phase === null ? '未定义' : `${formatValue(phase)} rad`,
        };
    });
});
const complexPeak = computed(() => {
    let index = 0;
    let magnitude = 0;
    complexRows.value.forEach((entry) => {
        if (entry.magnitude > magnitude) {
            index = entry.index;
            magnitude = entry.magnitude;
        }
    });
    return { index, magnitude, row: complexRows.value[index] };
});
const complexPeakLabel = computed(() =>
    complexRows.value.length > 0
        ? `bin ${complexPeak.value.index} / ${formatSignedFrequency(
            complexPeak.value.row?.frequency ?? 0,
        )} / ${formatValue(complexPeak.value.magnitude)}`
        : '—');
const complexPeakPhaseLabel = computed(() =>
    complexPeak.value.row?.phase === null
        || complexPeak.value.row?.phase === undefined
        ? '未定义'
        : `${formatValue(complexPeak.value.row.phase)} rad`);

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

const formatSignedFrequency = (hertz: number): string => {
    const sign = hertz < 0 ? '−' : hertz > 0 ? '+' : '';
    const absolute = Math.abs(hertz);
    return absolute >= 1000
        ? `${sign}${(absolute / 1000).toFixed(2)} kHz`
        : `${sign}${absolute.toFixed(1)} Hz`;
};

const binFrequency = (index: number): number =>
    props.sampleRate
        ? index * props.sampleRate / 1024
        : 0;

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

const canvasMetrics = () => {
    const rect = plotElement.value?.getBoundingClientRect();
    return {
        width: Math.max(1, Math.round(rect?.width ?? 1)),
        height: Math.max(1, Math.round(rect?.height ?? 1)),
        dpr: Math.max(1, window.devicePixelRatio || 1),
    };
};

const renderRequest = (): EditorRenderRequest => {
    const metrics = canvasMetrics();
    return {
        feature: definition.value,
        series: props.series,
        viewport: props.viewport,
        widthCssPixels: metrics.width,
        heightCssPixels: metrics.height,
        devicePixelRatio: metrics.dpr,
    };
};

const prepareCanvas = (canvas: HTMLCanvasElement) => {
    const metrics = canvasMetrics();
    return prepareCanvasSurface(
        canvas,
        metrics.width,
        metrics.height,
        metrics.dpr,
    );
};

const drawStatic = () => {
    const canvas = staticCanvas.value;
    if (!canvas) return;
    analysisCanvasRenderer.drawStatic(
        renderRequest(),
        prepareCanvas(canvas),
    );
};

const drawCursor = () => {
    const canvas = cursorCanvas.value;
    if (!canvas) return;
    analysisCanvasRenderer.drawCursor(
        renderRequest(),
        props.cursorSeconds,
        props.exactValue,
        prepareCanvas(canvas),
    );
};

const render = async () => {
    if (!props.expanded) return;
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
    () => {
        if (props.expanded) void render();
    },
    { deep: false },
);

watch(
    () => [props.cursorSeconds, props.exactValue],
    () => {
        if (!props.expanded) return;
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

const attachResizeObserver = async () => {
    await nextTick();
    if (!props.expanded) return;
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => void render());
    if (plotElement.value) resizeObserver.observe(plotElement.value);
    void render();
};

watch(
    () => props.expanded,
    (expanded) => {
        if (expanded) {
            void attachResizeObserver();
        } else {
            resizeObserver?.disconnect();
            resizeObserver = null;
            rendererError.value = null;
        }
    },
    { flush: 'post' },
);

onMounted(() => {
    if (props.expanded) void attachResizeObserver();
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

.plot.plot-structured {
    height: 320px;
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
}

.table-scroll.compact {
    max-height: 170px;
}

.table-scroll.complex-table {
    max-height: 320px;
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
