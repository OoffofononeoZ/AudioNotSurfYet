<template>
    <article class="analysis-card" :data-feature-id="featureId" :aria-labelledby="titleId">
        <header class="card-header">
            <div class="card-heading"><h2 :id="titleId">{{ definition.label }}</h2><span class="eyebrow">{{ definition.outputShape }}</span></div>
            <button type="button" class="toggle-card" :aria-label="expanded ? '收起分析' : '展开分析'"
                :title="expanded ? '收起分析' : '展开分析'" :aria-expanded="expanded"
                :aria-controls="bodyId" @click="$emit('toggle')">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="expanded ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'" /></svg>
            </button>
        </header>
        <AnalyzerFeatureDescription :feature-id="featureId" :label="definition.label"
            :text="definition.description" :expanded="descriptionExpanded" @toggle="$emit('toggle-description')" />
        <div v-if="expanded" :id="bodyId" class="card-body">
            <AnalyzerPlot :feature-id="featureId" :series="series" :viewport="viewport"
                :cursor-seconds="cursorSeconds" :duration-seconds="durationSeconds"
                :exact-value="exactValue" :analysis-state="analysisState"
                @seek="$emit('seek', $event)" @zoom="(factor, anchor) => $emit('zoom', factor, anchor)" />
            <AnalyzerFeatureValues :feature-id="featureId" :viewport="viewport"
                :duration-seconds="durationSeconds" :sample-rate="sampleRate" :exact-value="exactValue" />
        </div>
    </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AnalyzerFeatureDescription from './AnalyzerFeatureDescription.vue';
import AnalyzerPlot from './AnalyzerPlot.vue';
import AnalyzerFeatureValues from './AnalyzerFeatureValues.vue';
import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import type { AnalysisCoordinatorState, AnalysisCursorValueResult, AnalysisSeries, M10FeatureId } from '../analysis/types';
import type { PersistedTimelineViewport } from '../types/session';
const props = defineProps<{
    featureId: M10FeatureId;
    expanded: boolean;
    descriptionExpanded: boolean;
    series: AnalysisSeries | null;
    viewport: PersistedTimelineViewport;
    cursorSeconds: number;
    durationSeconds: number;
    sampleRate: number | null;
    exactValue: AnalysisCursorValueResult | null;
    analysisState: AnalysisCoordinatorState;
}>();
defineEmits<{
    toggle: [];
    'toggle-description': [];
    seek: [seconds: number];
    zoom: [factor: number, anchorSeconds: number];
}>();
const definition = computed(() => FEATURE_REGISTRY[props.featureId]);
const titleId = computed(() => 'analysis-card-' + props.featureId + '-title');
const bodyId = computed(() => 'analysis-card-' + props.featureId + '-body');
</script>

<style scoped>
.analysis-card { position: relative; min-width: 0; padding: 16px clamp(16px, 4%, 64px); color: var(--ink); }
.analysis-card::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, #0000, var(--main-color), #0000); pointer-events: none; }
.card-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.card-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px; min-width: 0; }
.card-header h2 { margin: 0; font-size: 1.05rem; font-weight: 680; letter-spacing: -0.02em; }
.eyebrow { color: var(--mute); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em; }
.toggle-card { flex: none; display: grid; place-items: center; width: 32px; height: 32px;
    border: 0; border-radius: 5px; padding: 6px; background: transparent; color: var(--body); cursor: pointer; }
.toggle-card svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; }
.toggle-card:hover { background: var(--control-hover); color: var(--accent); }
.toggle-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.card-body { margin-top: 14px; }
</style>
