<template>
    <div ref="root" class="analysis-source-cascader" data-testid="analysis-source-cascader">
        <el-cascader-panel :model-value="path" :options="options" :border="false" @change="select">
            <template #default="{ data }"
                ><span :data-feature-id="data.featureId" :data-source="data.children ? data.value : undefined">{{
                    data.label
                }}</span></template
            >
        </el-cascader-panel>
    </div>
</template>
<script setup lang="ts">
import { computed, onUpdated, onMounted, ref } from 'vue';
import { FEATURE_IDS, type FeatureId } from '../analysis/types';
import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import { STEM_FEATURE_IDS, isStemRole, type AnalysisInput } from '../analysis/sources';
import { useStemAvailability } from '../analysis/useStemAvailability';
import { FT_ROLES } from '../processing/modelManifest';
import { STEM_PRESENTATION } from '../processing/presentation';
const props = defineProps<{ featureId: FeatureId | null; stemRole?: import('../processing/modelManifest').StemRole }>();
const emit = defineEmits<{ select: [input: AnalysisInput] }>();
const { available } = useStemAvailability(),
    root = ref<HTMLElement | null>(null);
const path = computed(() => (props.featureId ? [props.stemRole ?? 'original', props.featureId] : []));
const children = (ids: readonly FeatureId[]) =>
    ids.map(id => ({ value: id, featureId: id, label: FEATURE_REGISTRY[id].label }));
const options = computed(() => [
    { value: 'original', label: '原曲', children: children(FEATURE_IDS) },
    ...(available.value
        ? FT_ROLES.map(role => ({
              value: role,
              label: `${role}（${STEM_PRESENTATION[role].label}）`,
              children: children(STEM_FEATURE_IDS),
          }))
        : props.stemRole
          ? [
                {
                    value: props.stemRole,
                    label: `${props.stemRole}（需完成音频分离）`,
                    disabled: true,
                    children: children(STEM_FEATURE_IDS),
                },
            ]
          : []),
]);
function select(value: unknown) {
    if (!Array.isArray(value) || value.length !== 2 || !(FEATURE_IDS as readonly unknown[]).includes(value[1])) return;
    if (value[0] !== 'original' && (!available.value || !isStemRole(value[0]))) return;
    emit('select', { featureId: value[1] as FeatureId, ...(isStemRole(value[0]) ? { stemRole: value[0] } : {}) });
}
function scrollbars() {
    root.value?.querySelectorAll('.el-scrollbar__wrap').forEach(el => el.classList.add('app-scrollbar'));
}
onMounted(scrollbars);
onUpdated(scrollbars);
</script>
<style scoped>
.analysis-source-cascader {
    --el-bg-color-overlay: var(--overlay-menu);
    --el-text-color-regular: var(--ink);
    --el-color-primary: var(--accent);
    --el-fill-color-light: var(--control-hover);
    --el-border-color-light: var(--overlay-hairline-soft);
}
.analysis-source-cascader :deep(.el-cascader-panel) {
    width: 100%;
    font-size: 12px;
}
.analysis-source-cascader :deep(.el-cascader-menu) {
    min-width: 0;
    flex: 1;
    max-width: 60%;
    color: var(--ink);
}
.analysis-source-cascader :deep(.el-cascader-menu__wrap) {
    height: min(420px, calc(100dvh - var(--app-player-inset, 80px) - 90px));
}
.analysis-source-cascader :deep(.el-cascader-node) {
    padding-left: 12px;
    padding-right: 24px;
}
</style>
