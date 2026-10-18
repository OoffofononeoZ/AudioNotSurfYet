<template>
    <article class="marker-lane" :data-testid="`${lane.eventKind}-lane-${lane.id}`">
        <header class="marker-lane-heading">
            <div class="marker-lane-management">
                <button type="button" class="icon-button" :aria-label="`${collapsed ? '展开' : '折叠'}轨道 ${lane.name}`" :aria-expanded="!collapsed" @click="toggle"><EditorIcon :name="collapsed ? 'right' : 'down'" /></button>
                <input :id="`${lane.eventKind === 'range' ? 'range-' : ''}lane-name-${lane.id}`" :value="lane.name" :disabled="!editable" :aria-label="`轨道名称 ${lane.name}`"
                    :data-testid="`${lane.eventKind}-lane-name-${lane.id}`" @change="renameLane" @keydown.enter="($event.target as HTMLInputElement).blur()">
                <button type="button" class="icon-button" title="新增分类" :aria-label="`为 ${lane.name} 新增分类`" :data-testid="`add-${lane.eventKind === 'range' ? 'range-' : ''}inner-class-${lane.id}`" :disabled="!editable" @click="addClass"><EditorIcon name="plus" /></button>
                <EditorLaneDeleteButton :project="project" :lane-id="lane.id" :disabled="!editable" @update-project="publish" />
            </div>
            <div class="marker-lane-time-header" aria-hidden="true" />
        </header>
        <template v-if="!collapsed">
            <div v-for="category in lane.innerClasses" :key="category.id" class="marker-category-row">
                <div class="marker-category-management">
                    <span class="category-indent" aria-hidden="true">└</span>
                    <input :value="category.label" :aria-label="`${lane.name} 的分类 ${category.label}`" :disabled="!editable"
                        :data-testid="`${lane.eventKind === 'range' ? 'range-' : ''}inner-class-name-${category.id}`" @change="renameClass(category.id,$event)" @keydown.enter="($event.target as HTMLInputElement).blur()">
                    <button type="button" class="icon-button" :aria-label="`删除分类 ${category.label}`" :disabled="!editable || lane.innerClasses.length <= 1"
                        :data-testid="`delete-${lane.eventKind === 'range' ? 'range-' : ''}inner-class-${category.id}`" @click="requestRemoval(category.id)"><EditorIcon name="trash" /></button>
                </div>
                <EditorMarkerSurface :project="project" :lane="lane" :inner-class-id="category.id" :view="view" :setting="setting" :editing="editing" :drawing="drawing" />
            </div>
        </template>
        <Teleport to="body">
            <dialog ref="dialog" class="marker-class-dialog" :aria-labelledby="`class-dialog-title-${lane.id}`" @cancel="close">
                <template v-if="removal">
                <h3 :id="`class-dialog-title-${lane.id}`">处理分类中的标记</h3>
                <p>“{{ removal?.label }}”中有 {{ removal?.count }} 个标记。请选择迁移或删除。</p>
                <label>迁移目标<select v-if="removal" v-model="removal.target" data-testid="inner-class-migration-target"><option v-for="category in targets" :key="category.id" :value="category.id">{{ category.label }}</option></select></label>
                <p v-if="error" role="alert">{{ error }}</p>
                <div class="dialog-actions"><button type="button" data-testid="confirm-inner-class-migration" @click="remove('migrate')">迁移并删除分类</button><button type="button" data-testid="confirm-inner-class-event-deletion" @click="remove('delete-events')">删除标记与分类</button><button type="button" data-testid="cancel-inner-class-removal" @click="close">取消</button></div>
                </template>
            </dialog>
        </Teleport>
    </article>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import EditorIcon from './EditorIcon.vue';
import EditorMarkerSurface from './EditorMarkerSurface.vue';
import EditorLaneDeleteButton from './EditorLaneDeleteButton.vue';
import { addPointInnerClass, removePointInnerClass, renamePointInnerClass, renamePointLane, type InnerClassRemovalResolution } from '../editor/pointAnnotations';
import { addRangeInnerClass, removeRangeInnerClass, renameRangeInnerClass, renameRangeLane } from '../editor/rangeAnnotations';
import type { EditorLaneV1, EditorProjectV1 } from '../editor/types';
import type { MarkerTimeView } from '../editor/markerTimeView';
import type { EditorBeatSnapSetting } from '../editor/beatSnap';
import type { MarkerEditing } from '../editor/useMarkerEditing';
import type { MarkerDrawing } from '../editor/markerDrawing';
const props = defineProps<{ project: EditorProjectV1; lane: EditorLaneV1; view: MarkerTimeView; editable: boolean; setting: EditorBeatSnapSetting; editing: MarkerEditing; drawing: MarkerDrawing }>();
const emit = defineEmits<{ updateProject: [project: EditorProjectV1]; status: [message: string] }>();
const collapsed = ref(false), dialog = ref<HTMLDialogElement | null>(null), error = ref('');
const removal = ref<{ id: string; label: string; count: number; target: string } | null>(null);
const targets = computed(() => props.lane.innerClasses.filter(category => category.id !== removal.value?.id));
let returnFocus: HTMLElement | null = null;
function publish(value: EditorProjectV1) { if (props.editable) emit('updateProject',value); }
function mutate(job: () => EditorProjectV1): boolean {
    if (!props.editable) return false;
    try { publish(job()); return true; } catch (failure) { error.value = failure instanceof Error ? failure.message : '无法修改轨道。'; emit('status',error.value); return false; }
}
function toggle() { props.editing.cancel(); collapsed.value = !collapsed.value; }
function renameLane(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!mutate(() => (props.lane.eventKind === 'point' ? renamePointLane : renameRangeLane)(props.project,props.lane.id,input.value))) input.value = props.lane.name;
}
function renameClass(id: string, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!mutate(() => (props.lane.eventKind === 'point' ? renamePointInnerClass : renameRangeInnerClass)(props.project,props.lane.id,id,input.value))) input.value = props.lane.innerClasses.find(category => category.id === id)!.label;
}
function addClass() { mutate(() => (props.lane.eventKind === 'point' ? addPointInnerClass : addRangeInnerClass)(props.project,props.lane.id)); }
async function requestRemoval(id: string) {
    if (!props.editable) return;
    const category = props.lane.innerClasses.find(value => value.id === id)!;
    const count = props.lane.events.filter(event => event.innerClassId === id).length;
    if (!count) { mutate(() => (props.lane.eventKind === 'point' ? removePointInnerClass : removeRangeInnerClass)(props.project,props.lane.id,id)); return; }
    returnFocus = document.activeElement as HTMLElement;
    removal.value = { id, label:category.label,count,target:props.lane.innerClasses.find(value => value.id !== id)!.id }; error.value = '';
    await nextTick(); dialog.value?.showModal(); dialog.value?.querySelector<HTMLButtonElement>('[data-testid="cancel-inner-class-removal"]')?.focus();
}
function close() { dialog.value?.close(); removal.value = null; if (returnFocus?.isConnected) returnFocus.focus({ preventScroll:true }); }
function remove(kind: 'migrate' | 'delete-events') {
    if (!removal.value) return;
    const resolution: InnerClassRemovalResolution = kind === 'migrate' ? { kind,targetInnerClassId:removal.value.target } : { kind };
    if (mutate(() => (props.lane.eventKind === 'point' ? removePointInnerClass : removeRangeInnerClass)(props.project,props.lane.id,removal.value!.id,resolution))) close();
}
watch(() => [props.project.projectId,props.editable], () => { if (!props.editable) close(); });
onBeforeUnmount(() => dialog.value?.close());
</script>
<style scoped>
.marker-lane { min-width:340px; border-bottom:1px solid var(--hairline-soft); }
.marker-lane-heading,.marker-category-row { display:grid; grid-template-columns:var(--marker-management-width,224px) minmax(180px,1fr); }
.marker-lane-heading { height:36px; background:#111c17; }
.marker-lane-management,.marker-category-management { display:flex; gap:3px; align-items:center; min-width:0; padding:0 6px; }
.marker-lane-management { height:36px; }.marker-category-management { height:48px; padding-left:18px; background:#0b120f; }
.marker-lane-time-header { position:relative; background:#101a15; }
.marker-lane-time-header::after { content:''; position:absolute; top:0; bottom:0; left:15%; width:1px; background:#b7dfcf; opacity:.6; }
input { width:100%; min-width:0; height:26px; padding:3px 4px; border:1px solid transparent; border-radius:3px; color:var(--ink); background:transparent; font-family:inherit; font-size:12px; }
input:hover:not(:disabled),input:focus-visible { border-color:var(--hairline-focus); outline:none; background:var(--editor-control); }
.icon-button { flex:none; display:grid; place-items:center; width:24px; height:26px; padding:4px; border:0; background:transparent; color:var(--muted); cursor:pointer; }
.icon-button svg { width:16px; height:16px; }.icon-button:hover:not(:disabled) { color:var(--accent-soft); }.icon-button:focus-visible { outline:2px solid var(--accent-soft); outline-offset:-2px; }
button:disabled { opacity:.35; cursor:default; }input:disabled { opacity:.65; }.category-indent { color:var(--muted); font-size:12px; }
.marker-class-dialog { width:min(480px,calc(100vw - 32px)); padding:22px; border:1px solid var(--hairline-focus); border-radius:6px; color:var(--ink); background:var(--surface-2); font-size:13px; }
.marker-class-dialog::backdrop { background:#0008; }.marker-class-dialog h3 { margin-top:0; }.marker-class-dialog p { line-height:1.6; color:var(--body); }
.marker-class-dialog label { display:grid; gap:8px; }.dialog-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:18px; }
.marker-class-dialog button,.marker-class-dialog select { min-height:30px; border:1px solid var(--hairline); border-radius:4px; padding:5px 8px; background:var(--editor-control); color:var(--ink); }
</style>
