<template>
    <div class="viz-marker-input">
        <label v-if="selectionModes.length > 1" class="viz-field"
            ><span>选择方式</span
            ><AppSelect
                :model-value="mode"
                :options="modes"
                :label="label + '选择方式'"
                :disabled="disabled"
                @change="changeMode"
        /></label>
        <label class="viz-field"
            ><span>轨道</span
            ><AppSelect
                :model-value="laneId"
                :options="lanes"
                :label="label + '轨道'"
                :disabled="disabled"
                @change="changeLane"
        /></label>
        <template v-if="lane">
            <template v-if="mode === 'single'">
                <label class="viz-field"
                    ><span>分类</span
                    ><AppSelect
                        :model-value="classId"
                        @change="classId = String($event)"
                        :options="classes"
                        :label="label + '分类'"
                        :disabled="disabled"
                /></label>
                <label class="viz-field stacked"
                    ><span>{{ label }}</span
                    ><AppSelect
                        :model-value="singleValue"
                        :options="events"
                        :label="label"
                        :disabled="disabled"
                        @change="changeEvent"
                /></label>
            </template>
            <label v-else-if="categorySelection === 'single'" class="viz-field"
                ><span>分类</span
                ><AppSelect
                    :model-value="classId"
                    :options="classes"
                    :label="label + '分类'"
                    :disabled="disabled"
                    @change="changeClass" />
            </label>
            <div v-else class="viz-marker-classes">
                <label class="viz-field"
                    ><span>全部分类</span
                    ><input
                        type="checkbox"
                        :aria-label="label + '全部分类'"
                        :checked="binding.kind === 'collection' && !binding.innerClassIds"
                        :disabled="disabled"
                        @change="selectAll"
                /></label>
                <label v-for="entry in lane.innerClasses" :key="entry.id" class="viz-field"
                    ><span>{{ entry.label }}</span
                    ><input
                        type="checkbox"
                        :aria-label="label + '分类 ' + entry.label"
                        :checked="selectedClasses.includes(entry.id)"
                        :disabled="disabled"
                        @change="toggleClass(entry.id, $event)"
                /></label>
            </div>
        </template>
        <p v-if="!project.editorSnapshot" class="viz-muted">从底栏载入同歌 Editor 数据</p>
        <p v-else-if="binding.kind === 'unbound'" class="viz-muted">标记输入未配置</p>
    </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppSelect from '../controls/AppSelect.vue';
import type { MarkerBinding } from '../../visualizer/editorMarkerTypes';
import type { VisualizerProjectV6 } from '../../visualizer/compositionTypes';
const props = defineProps<{
    project: VisualizerProjectV6;
    binding: MarkerBinding;
    label: string;
    eventKind: 'point' | 'range';
    selectionModes: Array<'single' | 'collection'>;
    categorySelection?: 'single';
    disabled?: boolean;
}>();
const emit = defineEmits<{ change: [binding: MarkerBinding] }>();
const laneId = ref(''),
    classId = ref(''),
    mode = ref<'single' | 'collection'>(props.selectionModes[0]!);
watch(
    () => props.binding,
    b => {
        if (b.kind !== 'unbound') {
            laneId.value = b.laneId;
            mode.value = b.kind;
            if (props.categorySelection === 'single' && b.kind === 'collection')
                classId.value = b.innerClassIds?.[0] ?? '';
        } else if (props.categorySelection === 'single') classId.value = '';
    },
    { immediate: true },
);
const lane = computed(() =>
    props.project.editorSnapshot?.project.lanes.find(l => l.id === laneId.value && l.eventKind === props.eventKind),
);
const lanes = computed(() => [
    { value: '', label: '选择轨道' },
    ...(props.project.editorSnapshot?.project.lanes
        .filter(l => l.eventKind === props.eventKind)
        .map(l => ({ value: l.id, label: l.name })) ?? []),
]);
const classes = computed(() => [
    {
        value: '',
        label: props.categorySelection === 'single' && mode.value === 'collection' ? '选择一个分类' : '全部分类',
    },
    ...(lane.value?.innerClasses.map(c => ({ value: c.id, label: c.label })) ?? []),
]);
const singleValue = computed(() => (props.binding.kind === 'single' ? props.binding.eventId : ''));
const events = computed(() => [
    { value: '', label: props.eventKind === 'point' ? '选择一个点标记' : '选择一个范围标记' },
    ...(lane.value?.events
        .filter(e => !classId.value || e.innerClassId === classId.value)
        .map(e => ({
            value: e.id,
            label:
                (lane.value!.innerClasses.find(c => c.id === e.innerClassId)?.label ?? '') +
                ' · ' +
                ('atSeconds' in e
                    ? e.atSeconds.toFixed(3) + ' s'
                    : e.startSeconds.toFixed(3) + '–' + e.endSeconds.toFixed(3) + ' s'),
        })) ?? []),
]);
const selectedClasses = computed(() =>
    props.binding.kind === 'collection'
        ? (props.binding.innerClassIds ?? lane.value?.innerClasses.map(c => c.id) ?? [])
        : [],
);
const modes = computed(() =>
    props.selectionModes.map(value => ({ value, label: value === 'single' ? '单个标记' : '轨道与分类集合' })),
);
function changeMode(value: string | number) {
    mode.value = value as 'single' | 'collection';
    classId.value = '';
    emit(
        'change',
        mode.value === 'collection' && lane.value && !props.categorySelection
            ? { kind: 'collection', laneId: laneId.value }
            : { kind: 'unbound' },
    );
}
function changeLane(value: string | number) {
    laneId.value = String(value);
    classId.value = '';
    emit(
        'change',
        mode.value === 'collection' && lane.value && !props.categorySelection
            ? { kind: 'collection', laneId: laneId.value }
            : { kind: 'unbound' },
    );
}
function changeEvent(value: string | number) {
    emit(
        'change',
        value && lane.value ? { kind: 'single', laneId: laneId.value, eventId: String(value) } : { kind: 'unbound' },
    );
}
function changeClass(value: string | number) {
    classId.value = String(value);
    emit(
        'change',
        classId.value && lane.value
            ? { kind: 'collection', laneId: laneId.value, innerClassIds: [classId.value] }
            : { kind: 'unbound' },
    );
}
function selectAll(event: Event) {
    emit(
        'change',
        (event.target as HTMLInputElement).checked ? { kind: 'collection', laneId: laneId.value } : { kind: 'unbound' },
    );
}
function toggleClass(id: string, event: Event) {
    const ids = new Set(selectedClasses.value);
    if ((event.target as HTMLInputElement).checked) ids.add(id);
    else ids.delete(id);
    emit(
        'change',
        ids.size ? { kind: 'collection', laneId: laneId.value, innerClassIds: [...ids] } : { kind: 'unbound' },
    );
}
</script>
