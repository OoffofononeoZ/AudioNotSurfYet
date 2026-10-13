<template>
    <div class="feature-values">
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
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import { peakBin, signedFftBinFrequency } from '../analysis/rendererData';
import type { AnalysisCursorValueResult, M10FeatureId } from '../analysis/types';
import type { PersistedTimelineViewport } from '../types/session';

const props = defineProps<{
    featureId: M10FeatureId;
    viewport: PersistedTimelineViewport;
    durationSeconds: number;
    sampleRate: number | null;
    exactValue: AnalysisCursorValueResult | null;
}>();
const definition = computed(() => FEATURE_REGISTRY[props.featureId]);
const CHROMA_LABELS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const nyquist = computed(() => (props.sampleRate ?? 0) / 2);
const isSpectrumFeature = computed(() =>
    props.featureId === 'amplitudeSpectrum'
    || props.featureId === 'powerSpectrum');
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


</script>

<style scoped>
.axis-summary { display: flex; align-items: center; justify-content: space-between;
    color: var(--mute); font-size: 0.68rem; gap: 10px; margin-top: 7px; }
.facts {
    align-items: stretch;
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 14px 0 0;
}

.facts div {
    /* 极淡 tint：保留数值，仅把基色统一到规范家族 */
    background: rgba(101, 255, 169, 0.06);
    border-radius: 9px;
    min-width: 0;
    padding: 9px;
}

.facts dt {
    color: var(--mute);
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
    /* 极淡分隔：保留数值，仅把基色统一到规范家族 */
    border-top: 1px solid rgba(101, 255, 169, 0.15);
    color: var(--body);
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
    /* 极淡分隔：保留数值，仅把基色统一到规范家族 */
    border-bottom: 1px solid rgba(101, 255, 169, 0.1);
    padding: 6px;
    text-align: right;
}

th:first-child,
td:first-child {
    text-align: left;
}


@media (max-width: 720px) { .facts { grid-template-columns: 1fr; } }
</style>
