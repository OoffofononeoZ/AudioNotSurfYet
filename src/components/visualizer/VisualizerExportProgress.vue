<template>
    <div v-if="active" class="viz-export-progress" :data-phase="state.status" aria-live="off">
        <div class="flex min-w-0 items-center justify-between gap-4">
            <span class="viz-export-progress__stage"><i aria-hidden="true" />{{ stage }}</span>
            <span v-if="percentage !== null" class="viz-export-progress__value" aria-hidden="true"
                >{{ percentage.toFixed(1) }}<small>%</small></span
            >
        </div>
        <div
            class="viz-export-progress__track"
            :class="{ 'is-indeterminate': ratio === null }"
            role="progressbar"
            aria-label="视频导出进度"
            :aria-valuenow="percentage ?? undefined"
            :aria-valuemin="0"
            :aria-valuemax="100"
            :aria-valuetext="percentage === null ? stage : percentage.toFixed(1) + '%'">
            <span
                class="viz-export-progress__fill"
                :style="ratio === null ? undefined : { width: ratio * 100 + '%' }" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { VisualizerExportState } from '../../visualizer/exportTypes';

const props = defineProps<{ state: VisualizerExportState }>();
const active = computed(() => ['preparing', 'exporting', 'finalizing'].includes(props.state.status));
const stage = computed(() => {
    switch (props.state.status) {
        case 'preparing':
            return '准备导出';
        case 'exporting':
            return '正在导出视频';
        case 'finalizing':
            return '正在生成 WebM';
        default:
            return '';
    }
});
const ratio = computed(() => {
    const state = props.state;
    if (
        state.status !== 'exporting' ||
        !Number.isFinite(state.totalFrames) ||
        state.totalFrames <= 0 ||
        !Number.isFinite(state.framesDone)
    )
        return null;
    return Math.min(1, Math.max(0, state.framesDone / state.totalFrames));
});
const percentage = computed(() => (ratio.value === null ? null : Math.floor(ratio.value * 1000) / 10));
</script>

<style scoped>
.viz-export-progress {
    display: grid;
    gap: 10px;
    min-width: 0;
    margin-top: 4px;
    padding: 10px 12px 12px;
    border: 1px solid var(--hairline-soft);
    border-radius: var(--radius-md);
    background: linear-gradient(110deg, var(--surface-chip), var(--surface-card));
}
.viz-export-progress__stage {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--body);
    font-size: 11px;
    line-height: 24px;
}
.viz-export-progress__stage i {
    width: 5px;
    height: 5px;
    flex: none;
    border-radius: 50%;
    background: var(--accent-soft);
    box-shadow: 0 0 8px var(--glow-accent);
}
.viz-export-progress__value {
    flex: none;
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: 22px;
    font-variant-numeric: tabular-nums;
    line-height: 24px;
    letter-spacing: -0.8px;
}
.viz-export-progress__value small {
    margin-left: 3px;
    color: var(--mute);
    font-size: 11px;
    letter-spacing: 0;
}
.viz-export-progress__track {
    position: relative;
    height: 6px;
    overflow: hidden;
    border-radius: var(--radius-pill);
    background: var(--hairline-faint);
    box-shadow: inset 0 1px 2px var(--surface-deep);
}
.viz-export-progress__fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--accent-soft), var(--accent-bright));
    box-shadow:
        0 0 10px var(--glow-accent),
        inset -2px 0 0 var(--accent-bright);
    transition: width 100ms linear;
}
.is-indeterminate .viz-export-progress__fill {
    width: 30%;
    background: linear-gradient(90deg, transparent, var(--accent-soft), transparent);
    box-shadow: none;
    animation: export-progress-drift 2.4s ease-in-out infinite alternate;
}
@keyframes export-progress-drift {
    from {
        transform: translateX(0);
    }
    to {
        transform: translateX(233.333%);
    }
}
@media (prefers-reduced-motion: reduce) {
    .viz-export-progress__fill {
        transition: none;
    }
    .is-indeterminate .viz-export-progress__fill {
        animation: none;
        transform: translateX(115%);
    }
}
</style>
