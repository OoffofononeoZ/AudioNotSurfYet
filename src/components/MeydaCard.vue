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
            <div class="table-scroll">
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
            <div class="table-scroll compact">
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
            <div class="table-scroll">
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
            <div class="table-scroll compact">
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
            <div class="table-scroll complex-table">
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
    loudnessAt,
    peakBin,
    scalarPlotDomain,
    signedVectorMaximum,
    signedFftBinFrequency,
    vectorAt,
    visibleSampleRange,
    waveformEnvelopeAt,
} from '../analysis/rendererData';
import {
    canvasXToTime,
    timeToCanvasX,
} from '../analysis/timelineViewport';
import {
    M10_AVAILABLE_FEATURE_IDS,
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
    slot: 0 | 1 | 2 | 3;
    featureId: M10FeatureId;
    disabledFeatureIds: readonly M10FeatureId[];
    series: AnalysisSeries | null;
    viewport: PersistedTimelineViewport;
    cursorSeconds: number;
    durationSeconds: number;
    sampleRate: number | null;
    exactValue: AnalysisCursorValueResult | null;
    analysisState: AnalysisCoordinatorState;
}>();

const emit = defineEmits<{
    change: [featureId: M10FeatureId];
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
const featureOptions = M10_AVAILABLE_FEATURE_IDS.map((id) => ({
    id,
    label: FEATURE_REGISTRY[id].label,
}));
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

const handleFeatureChange = (event: Event) => {
    const value = (event.target as HTMLSelectElement).value;
    if ((M10_AVAILABLE_FEATURE_IDS as readonly string[]).includes(value)) {
        emit('change', value as M10FeatureId);
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

const signedHeatColor = (value: number, maximum: number): string => {
    const intensity = Math.sqrt(Math.min(1, Math.abs(value) / maximum));
    if (value < 0) {
        return `hsl(265 82% ${8 + intensity * 58}%)`;
    }
    return `hsl(145 88% ${8 + intensity * 60}%)`;
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
    const signed = props.featureId === 'mfcc';
    let maximum = 0;
    for (let index = 0; index < payload.values.length; index += 1) {
        const value = (payload.values[index] ?? 0) * payload.scale
            + payload.offset;
        maximum = Math.max(maximum, signed ? Math.abs(value) : value);
    }
    maximum = Math.max(maximum, 0.000001);
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
            const value = values[bin] ?? 0;
            context.fillStyle = signed
                ? signedHeatColor(value, maximum)
                : heatColor(value, maximum);
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

const drawWaveform = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    series: AnalysisSeries,
) => {
    if (series.payload.kind !== 'waveform-envelope') {
        throw new Error('波形数据形态与 renderer 不匹配。');
    }
    const range = visibleSampleRange(series, props.viewport);
    const sampleCount = Math.max(1, range.endIndex - range.startIndex);
    const columns = Math.max(1, Math.min(width, sampleCount));
    const toY = (value: number) => height / 2 - value * (height / 2 - 7);
    context.strokeStyle = 'rgba(248, 255, 135, 0.45)';
    context.beginPath();
    context.moveTo(0, Math.round(height / 2) + 0.5);
    context.lineTo(width, Math.round(height / 2) + 0.5);
    context.stroke();
    context.strokeStyle = '#7dffb3';
    context.lineWidth = 1.5;
    for (let column = 0; column < columns; column += 1) {
        const sampleIndex = Math.min(
            range.endIndex - 1,
            range.startIndex + Math.floor(column * sampleCount / columns),
        );
        const envelope = waveformEnvelopeAt(series.payload, sampleIndex);
        const x = column / Math.max(1, columns - 1) * width;
        context.beginPath();
        context.moveTo(x, toY(envelope.max));
        context.lineTo(x, toY(envelope.min));
        context.stroke();
    }
};

const drawLoudness = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    series: AnalysisSeries,
) => {
    if (series.payload.kind !== 'loudness') {
        throw new Error('响度数据形态与 renderer 不匹配。');
    }
    const payload = series.payload;
    const range = visibleSampleRange(series, props.viewport);
    const heatmapHeight = Math.floor(height * 0.68);
    const sampleCount = Math.max(1, range.endIndex - range.startIndex);
    const columns = Math.max(1, Math.min(width, sampleCount));
    let maximumSpecific = 0;
    for (const value of payload.specific) {
        maximumSpecific = Math.max(
            maximumSpecific,
            value * payload.scale + payload.offset,
        );
    }
    maximumSpecific = Math.max(maximumSpecific, 0.000001);
    for (let column = 0; column < columns; column += 1) {
        const sampleIndex = Math.min(
            range.endIndex - 1,
            range.startIndex + Math.floor(column * sampleCount / columns),
        );
        const current = loudnessAt(payload, sampleIndex);
        const x0 = Math.floor(column * width / columns);
        const x1 = Math.ceil((column + 1) * width / columns);
        current.specific.forEach((value, band) => {
            context.fillStyle = heatColor(value, maximumSpecific);
            const y = heatmapHeight
                - Math.ceil((band + 1) * heatmapHeight / payload.bands);
            context.fillRect(
                x0,
                y,
                Math.max(1, x1 - x0),
                Math.ceil(heatmapHeight / payload.bands) + 1,
            );
        });
    }
    const totals = payload.total.subarray(range.startIndex, range.endIndex);
    const domain = scalarPlotDomain(totals, { min: 0 });
    const chartTop = heatmapHeight + 8;
    const chartBottom = height - 7;
    const toY = (value: number) => chartBottom
        - (value - domain.min) / (domain.max - domain.min)
        * (chartBottom - chartTop);
    context.strokeStyle = 'rgba(132, 255, 185, 0.35)';
    context.beginPath();
    context.moveTo(0, heatmapHeight + 0.5);
    context.lineTo(width, heatmapHeight + 0.5);
    context.stroke();
    context.strokeStyle = '#7dffb3';
    context.lineWidth = 2;
    context.beginPath();
    totals.forEach((value, localIndex) => {
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
    context.fillStyle = '#d5ffe5';
    context.font = '11px ui-monospace, monospace';
    context.fillText('24 Bark bands', 8, 15);
    context.fillText('Total loudness', 8, heatmapHeight + 16);
};

const phaseRgb = (phase: number): [number, number, number] => {
    const hue = ((phase / (Math.PI * 2)) + 1) % 1 * 6;
    const sector = Math.floor(hue);
    const fraction = hue - sector;
    const high = 232;
    const low = 48;
    const rising = Math.round(low + (high - low) * fraction);
    const falling = Math.round(high - (high - low) * fraction);
    switch (sector) {
        case 0: return [high, rising, low];
        case 1: return [falling, high, low];
        case 2: return [low, high, rising];
        case 3: return [low, falling, high];
        case 4: return [rising, low, high];
        default: return [high, low, falling];
    }
};

const drawComplex = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    series: AnalysisSeries,
) => {
    if (series.payload.kind !== 'complex-derived') {
        throw new Error('复频谱数据形态与 renderer 不匹配。');
    }
    const payload = series.payload;
    const range = visibleSampleRange(series, props.viewport);
    const sampleCount = Math.max(1, range.endIndex - range.startIndex);
    const columns = Math.max(1, Math.min(width, sampleCount));
    const bins = payload.bins;
    const magnitudeImage = new ImageData(columns, bins);
    const phaseImage = new ImageData(columns, bins);
    let maximumMagnitude = 0;
    for (const value of payload.magnitude) {
        maximumMagnitude = Math.max(
            maximumMagnitude,
            value * payload.magnitudeScale,
        );
    }
    maximumMagnitude = Math.max(maximumMagnitude, 0.000001);
    for (let column = 0; column < columns; column += 1) {
        const sampleIndex = Math.min(
            range.endIndex - 1,
            range.startIndex + Math.floor(column * sampleCount / columns),
        );
        const sourceOffset = sampleIndex * bins;
        for (let bin = 0; bin < bins; bin += 1) {
            const sourceIndex = sourceOffset + bin;
            const row = bins - 1 - bin;
            const target = (row * columns + column) * 4;
            const magnitude = (payload.magnitude[sourceIndex] ?? 0)
                * payload.magnitudeScale;
            const intensity = Math.sqrt(magnitude / maximumMagnitude);
            magnitudeImage.data[target] = Math.round(7 + intensity * 118);
            magnitudeImage.data[target + 1] = Math.round(16 + intensity * 239);
            magnitudeImage.data[target + 2] = Math.round(12 + intensity * 167);
            magnitudeImage.data[target + 3] = 255;
            if (magnitude === 0) {
                phaseImage.data[target] = 12;
                phaseImage.data[target + 1] = 20;
                phaseImage.data[target + 2] = 16;
            } else {
                const phase = Math.max(
                    -1,
                    Math.min(1, (payload.phase[sourceIndex] ?? 0) / 32_767),
                ) * Math.PI;
                const [red, green, blue] = phaseRgb(phase);
                phaseImage.data[target] = red;
                phaseImage.data[target + 1] = green;
                phaseImage.data[target + 2] = blue;
            }
            phaseImage.data[target + 3] = 255;
        }
    }
    const source = document.createElement('canvas');
    source.width = columns;
    source.height = bins;
    const sourceContext = source.getContext('2d');
    if (!sourceContext) throw new Error('复频谱离屏 Canvas 不可用。');
    const divider = Math.floor(height / 2);
    context.imageSmoothingEnabled = false;
    sourceContext.putImageData(magnitudeImage, 0, 0);
    context.drawImage(source, 0, 0, width, divider - 2);
    sourceContext.putImageData(phaseImage, 0, 0);
    context.drawImage(source, 0, divider + 2, width, height - divider - 2);
    context.strokeStyle = 'rgba(132, 255, 185, 0.45)';
    context.beginPath();
    context.moveTo(0, divider + 0.5);
    context.lineTo(width, divider + 0.5);
    context.stroke();
    context.fillStyle = '#f2fff7';
    context.font = '11px ui-monospace, monospace';
    context.fillText('Magnitude · bins 0–1023', 8, 15);
    context.fillText('Phase · −π…π', 8, divider + 17);
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
    } else if (definition.value.outputShape === 'waveform') {
        drawWaveform(context, width, height, props.series);
    } else if (definition.value.outputShape === 'loudness-structure') {
        drawLoudness(context, width, height, props.series);
    } else if (definition.value.outputShape === 'complex-spectrum') {
        drawComplex(context, width, height, props.series);
    } else {
        drawHeatmap(context, width, height, props.series);
    }
};

const drawLoudnessCursor = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
) => {
    const values = exactLoudness.value.specific;
    if (values.length !== 24) return;
    const panelWidth = Math.min(190, Math.max(120, width * 0.28));
    const left = width - panelWidth;
    const panelHeight = Math.floor(height * 0.68);
    const maximum = Math.max(0.000001, ...values);
    context.fillStyle = 'rgba(2, 8, 5, 0.88)';
    context.fillRect(left, 0, panelWidth, panelHeight);
    const rowHeight = panelHeight / values.length;
    values.forEach((value, index) => {
        const barWidth = Math.max(1, value / maximum * (panelWidth - 34));
        const y = panelHeight - (index + 1) * rowHeight;
        context.fillStyle = '#7dffb3';
        context.fillRect(left + 30, y + 1, barWidth, Math.max(1, rowHeight - 2));
        if (index % 4 === 0) {
            context.fillStyle = '#d5ffe5';
            context.font = '9px ui-monospace, monospace';
            context.fillText(`B${index}`, left + 4, y + rowHeight - 2);
        }
    });
};

const drawBufferCursorFrame = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    values: readonly number[],
) => {
    const top = Math.floor(height * 0.7);
    const bottom = height - 4;
    const baseline = (top + bottom) / 2;
    const amplitude = (bottom - top) / 2 - 2;
    context.fillStyle = 'rgba(2, 8, 5, 0.86)';
    context.fillRect(0, top, width, bottom - top + 1);
    context.strokeStyle = 'rgba(248, 255, 135, 0.45)';
    context.beginPath();
    context.moveTo(0, baseline + 0.5);
    context.lineTo(width, baseline + 0.5);
    context.stroke();
    context.strokeStyle = '#7dffb3';
    context.lineWidth = 1;
    context.beginPath();
    values.forEach((value, index) => {
        const px = index / Math.max(1, values.length - 1) * width;
        const py = baseline - Math.max(-1, Math.min(1, value)) * amplitude;
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
    });
    context.stroke();
};

const drawMfccCursor = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    values: readonly number[],
) => {
    const top = Math.floor(height * 0.72);
    const bottom = height - 4;
    const baseline = (top + bottom) / 2;
    const maximum = signedVectorMaximum(values);
    context.strokeStyle = 'rgba(248, 255, 135, 0.55)';
    context.beginPath();
    context.moveTo(0, baseline + 0.5);
    context.lineTo(width, baseline + 0.5);
    context.stroke();
    const barWidth = width / values.length;
    values.forEach((value, index) => {
        const barHeight = Math.abs(value) / maximum * (bottom - top) / 2;
        context.fillStyle = value < 0 ? '#b58cff' : '#7dffb3';
        context.fillRect(
            index * barWidth + 1,
            value < 0 ? baseline : baseline - barHeight,
            Math.max(1, barWidth - 2),
            barHeight,
        );
    });
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
    if (props.featureId === 'loudness') {
        drawLoudnessCursor(context, width, height);
        return;
    }
    if (props.featureId === 'complexSpectrum') return;
    const values = cursorVector();
    if (values.length === 0) return;
    if (props.featureId === 'buffer') {
        drawBufferCursorFrame(context, width, height, values);
        return;
    }
    if (props.featureId === 'mfcc') {
        drawMfccCursor(context, width, height, values);
        return;
    }
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
