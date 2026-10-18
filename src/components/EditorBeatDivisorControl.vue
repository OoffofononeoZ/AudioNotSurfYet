<template>
    <div class="beat-divisor" aria-label="节拍细分" data-testid="editor-beat-divisor" :data-divisor="setting.divisor">
        <div class="divisor-ticks">
            <i v-for="index in setting.divisor + 1" :key="index" :style="{ left: `${(index - 1) / setting.divisor * 100}%`, height: `${divisorHeight(divisorForIndex(index - 1, setting.divisor)) * 100}%`, background: divisorColour(divisorForIndex(index - 1, setting.divisor)) }" />
            <input type="range" aria-label="节拍细分刻度" :min="0" :max="presets.length - 1" :value="presets.indexOf(setting.divisor)" @input="set({ ...setting, divisor: presets[Number(($event.target as HTMLInputElement).value)]! })">
        </div>
        <div class="divisor-value">
            <button type="button" aria-label="减小节拍细分" :disabled="presets.indexOf(setting.divisor) <= 0" @click="cycle(-1)">‹</button>
            <strong>每拍 {{ setting.divisor }} 等分</strong>
            <button type="button" aria-label="增大节拍细分" :disabled="presets.indexOf(setting.divisor) >= presets.length - 1" @click="cycle(1)">›</button>
        </div>
        <AppSelect :model-value="setting.preset" label="细分预设" :options="presetOptions" @update:model-value="changePreset" />
        <AppNumberInput v-if="setting.preset === 'custom'" :model-value="customMaximum" label="自定义细分" :min="1" :max="64" @update:model-value="changeCustom" />
        <span v-if="message" class="preference-error" role="status">{{ message }}</span>
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import AppSelect from './controls/AppSelect.vue';
import AppNumberInput from './controls/AppNumberInput.vue';
import { useEditorGrid } from '../editor/useEditorGrid';
import { divisorColour, divisorForIndex, divisorHeight, snapPresets, type BeatSnapPreset } from '../editor/beatSnap';
const { setting, message, set } = useEditorGrid();
const customMaximum = computed(() => setting.value.customDivisor);
const presets = computed(() => snapPresets(setting.value));
const presetOptions = [{ value: 'common', label: '常规' }, { value: 'triplets', label: '三连音' }, { value: 'custom', label: '自定义' }];
function changePreset(value: string | number) {
    const preset = value as BeatSnapPreset;
    set({ preset, divisor: preset === 'common' ? 4 : preset === 'triplets' ? 6 : customMaximum.value, customDivisor: customMaximum.value });
}
function changeCustom(divisor: number) { set({ preset: 'custom', divisor, customDivisor: divisor }); }
function cycle(direction: number) {
    const divisor = presets.value[presets.value.indexOf(setting.value.divisor) + direction];
    if (divisor) set({ ...setting.value, divisor });
}
</script>
<style scoped>
.beat-divisor { display:grid; grid-template-columns:minmax(0,1fr) 88px; align-items:center; gap:4px 8px; position:relative; font-size:11px; }
.divisor-ticks { position:relative; height:20px; grid-column:1 / -1; grid-row:2; margin:0 2px; }
.divisor-ticks i { position:absolute; top:50%; transform:translateY(-50%); width:1px; opacity:.9; }
.divisor-ticks input { position:absolute; inset:0; margin:0; padding:0; width:100%; height:100%; opacity:0; cursor:pointer; }
.divisor-ticks:focus-within { outline:2px solid var(--accent-soft); outline-offset:3px; }
.divisor-value { display:flex; align-items:center; justify-content:space-between; gap:6px; }
.divisor-value strong { font-weight:500; white-space:nowrap; font-variant-numeric:tabular-nums; }
.divisor-value button { border:0; padding:0 4px; min-height:28px; color:var(--body); background:transparent; font-size:20px; cursor:pointer; }
.divisor-value button:disabled { opacity:.3; cursor:default; }
.beat-divisor :deep(.app-select) { width:88px; min-height:28px; padding:3px 6px; }
.beat-divisor :deep(.app-number-input) { grid-column:1 / -1; width:100%; min-height:28px; }
.preference-error { grid-column:1 / -1; color:var(--error); font-size:11px; }
</style>
