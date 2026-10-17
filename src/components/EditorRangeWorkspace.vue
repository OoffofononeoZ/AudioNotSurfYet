<template>
    <div class="range-workspace" data-testid="editor-range-workspace">
        <article
            v-for="lane in rangeLanes"
            :key="lane.id"
            class="range-lane-card"
            :data-testid="`range-lane-${lane.id}`"
        >
            <div class="range-lane-grid" :style="{ '--lane-rows': lane.innerClasses.length }">
                <div class="range-lane-meta">
                    <label :for="`range-lane-name-${lane.id}`">名称</label>
                    <input
                        :id="`range-lane-name-${lane.id}`"
                        :value="laneNameDrafts[lane.id] ?? lane.name"
                        :data-testid="`range-lane-name-${lane.id}`"
                        @input="captureLaneNameDraft(lane.id, $event)"
                        @blur="commitLaneName(lane.id, $event)"
                        @keydown.enter.prevent="commitInputOnEnter"
                    >
                    <span class="range-lane-kind">range · {{ lane.events.length }} 个范围</span>
                    <button
                        type="button"
                        :data-testid="`add-range-inner-class-${lane.id}`"
                        @click="addInnerClass(lane.id)"
                    >
                        ＋ 分类
                    </button>
                    <EditorLaneDeleteButton :project="project" :lane-id="lane.id" @update-project="applyProject" @removed="clearInteraction" />
                </div>

                <template v-for="(innerClass, innerIndex) in lane.innerClasses" :key="innerClass.id">
                    <div class="range-inner-class-cell" :style="{ gridRow: innerIndex + 1 }">
                        <label class="sr-only" :for="`range-inner-name-${innerClass.id}`">
                            {{ lane.name }} 的内部分类
                        </label>
                        <input
                            :id="`range-inner-name-${innerClass.id}`"
                            :value="innerClassNameDrafts[innerClass.id] ?? innerClass.label"
                            :data-testid="`range-inner-class-name-${innerClass.id}`"
                            @input="captureInnerClassNameDraft(innerClass.id, $event)"
                            @blur="commitInnerClassName(lane.id, innerClass.id, $event)"
                            @keydown.enter.prevent="commitInputOnEnter"
                        >
                        <button
                            type="button"
                            class="range-delete-class"
                            :disabled="lane.innerClasses.length <= 1"
                            :aria-label="`删除范围分类 ${innerClass.label}`"
                            :data-testid="`delete-range-inner-class-${innerClass.id}`"
                            @click="requestInnerClassRemoval(lane, innerClass)"
                        >
                            删除
                        </button>
                    </div>

                    <div
                        :ref="(element) => setSurfaceRef(lane.id, innerClass.id, element)"
                        class="marker-surface range-surface"
                        :class="{
                            'is-candidate': isActiveCandidate(lane.id, innerClass.id),
                            'is-pending': isPendingSurface(lane.id, innerClass.id),
                            'is-block-mode': blockMode,
                        }"
                        :style="{ gridRow: innerIndex + 1 }"
                        :data-testid="`range-surface-${lane.id}-${innerClass.id}`"
                        :data-lane-id="lane.id"
                        :data-inner-class-id="innerClass.id"
                        :data-candidate-seconds="candidate?.laneId === lane.id && candidate?.innerClassId === innerClass.id ? candidate.timeSeconds : undefined"
                        tabindex="0"
                        role="application"
                        :aria-label="`${lane.name}，${innerClass.label} 范围区域。第一次点击选择起点，第二次点击更晚位置完成。`"
                        @contextmenu.prevent
                        @dragstart.prevent
                        @pointerdown.capture="onSurfacePointerDown($event, lane.id, innerClass.id)"
                        @pointermove="onSurfacePointerMove"
                        @pointerup="onSurfacePointerUp"
                        @pointercancel="cancelSurfacePointer"
                        @lostpointercapture="cancelSurfacePointer"
                        @pointerleave="onSurfacePointerLeave(lane.id, innerClass.id)"
                        @focus="activateInitialCandidate(lane.id, innerClass.id)"
                        @keydown="onSurfaceKeydown($event, lane.id, innerClass.id)"
                    >
                        <canvas
                            :ref="(element) => setGridCanvasRef(lane.id, innerClass.id, element)"
                            class="range-grid-canvas"
                            aria-hidden="true"
                        />
                        <span
                            v-if="blockSelectionFor(lane.id, innerClass.id)"
                            class="marker-block-selection"
                            :class="{ 'is-preview': Boolean(blockPreview) }"
                            :style="blockSelectionStyle(lane.id, innerClass.id)"
                            aria-hidden="true"
                        >
                            <span>{{ blockSelectionCount }} 个 · {{ blockSelectionLabel }}</span>
                        </span>
                        <span
                            v-if="candidateFor(lane.id, innerClass.id)"
                            class="range-candidate"
                            :style="candidateStyle(lane.id, innerClass.id)"
                            aria-hidden="true"
                        />
                        <span
                            v-if="previewFor(lane.id, innerClass.id)"
                            class="range-preview"
                            :class="{ 'is-invalid': !previewFor(lane.id, innerClass.id)?.valid }"
                            :style="previewStyle(lane.id, innerClass.id)"
                            aria-hidden="true"
                        />

                        <template
                            v-for="range in visibleEvents(lane, innerClass.id)"
                            :key="range.id"
                        >
                            <button
                                :ref="(element) => setRangeRef(range.id, element)"
                                type="button"
                                class="range-marker"
                                :class="{ 'is-handle-preview': isHandlePreview(range) }"
                                :style="rangeStyle(range)"
                                :data-testid="`range-marker-${range.id}`"
                                :data-range-id="range.id"
                                :aria-label="`${innerClass.label} 范围，${formatTime(range.startSeconds)} 至 ${formatTime(range.endSeconds)}；右键或删除键移除`"
                                @click.stop="focusRange(lane.id, innerClass.id, range)"
                                @contextmenu.stop.prevent="removeRange(lane.id, innerClass.id, range)"
                                @focus="focusRange(lane.id, innerClass.id, range)"
                                @keydown="onRangeKeydown($event, lane.id, innerClass.id, range)"
                            >
                                <span aria-hidden="true">{{ formatDuration(range) }}</span>
                            </button>
                            <button
                                v-if="endpointVisible(range.startSeconds)"
                                type="button"
                                class="range-handle start"
                                :style="endpointStyle(range, 'start')"
                                :data-testid="`range-start-handle-${range.id}`"
                                :aria-label="`调整 ${innerClass.label} 范围起点 ${formatTime(range.startSeconds)}`"
                                @pointerdown.stop.prevent="beginHandleDrag($event, lane.id, innerClass.id, range, 'start')"
                                @pointermove.stop.prevent="moveHandleDrag"
                                @pointerup.stop.prevent="finishHandleDrag"
                                @pointercancel.stop.prevent="cancelHandleDrag"
                                @lostpointercapture.stop.prevent="cancelHandleDrag"
                                @contextmenu.stop.prevent="removeRange(lane.id, innerClass.id, range)"
                                @keydown="onHandleKeydown($event, lane.id, innerClass.id, range, 'start')"
                            >
                                <span aria-hidden="true">◀</span>
                            </button>
                            <button
                                v-if="endpointVisible(range.endSeconds)"
                                type="button"
                                class="range-handle end"
                                :style="endpointStyle(range, 'end')"
                                :data-testid="`range-end-handle-${range.id}`"
                                :aria-label="`调整 ${innerClass.label} 范围终点 ${formatTime(range.endSeconds)}`"
                                @pointerdown.stop.prevent="beginHandleDrag($event, lane.id, innerClass.id, range, 'end')"
                                @pointermove.stop.prevent="moveHandleDrag"
                                @pointerup.stop.prevent="finishHandleDrag"
                                @pointercancel.stop.prevent="cancelHandleDrag"
                                @lostpointercapture.stop.prevent="cancelHandleDrag"
                                @contextmenu.stop.prevent="removeRange(lane.id, innerClass.id, range)"
                                @keydown="onHandleKeydown($event, lane.id, innerClass.id, range, 'end')"
                            >
                                <span aria-hidden="true">▶</span>
                            </button>
                        </template>

                        <EditorContextMenu
                            v-if="quickMenu?.surfaceKey === surfaceKey(lane.id, innerClass.id)"
                            :anchor="surfaceRefs.get(quickMenu.surfaceKey)" :x="quickMenu.x" :y="quickMenu.y" test-id="editor-range-menu"
                            @action="$event === 'center' ? menuCenter() : menuSeek($event === 'play')" @close="quickMenu = null"
                        />
                    </div>
                </template>
            </div>
        </article>

        <div v-if="removalDialog" class="range-dialog-backdrop" @pointerdown.self="closeRemovalDialog">
            <section
                ref="dialogElement"
                class="range-removal-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="remove-range-class-title"
                tabindex="-1"
                @keydown.esc.prevent="closeRemovalDialog"
            >
                <h3 id="remove-range-class-title">处理分类中的范围</h3>
                <p>
                    “{{ removalDialog.label }}”中有 {{ removalDialog.eventCount }} 个范围。
                    请选择迁移到其他分类，或明确删除这些范围。
                </p>
                <label>
                    迁移目标
                    <select v-model="removalDialog.targetInnerClassId" data-testid="range-migration-target">
                        <option v-for="target in removalTargets" :key="target.id" :value="target.id">
                            {{ target.label }}
                        </option>
                    </select>
                </label>
                <p v-if="removalDialog.error" class="range-dialog-error" role="alert">
                    {{ removalDialog.error }}
                </p>
                <div class="range-dialog-actions">
                    <button type="button" data-testid="confirm-range-migration" @click="confirmMigration">
                        迁移并删除分类
                    </button>
                    <button type="button" class="danger" data-testid="confirm-range-event-deletion" @click="confirmEventDeletion">
                        删除范围与分类
                    </button>
                    <button type="button" data-testid="cancel-range-removal" @click="closeRemovalDialog">
                        取消
                    </button>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import EditorContextMenu from './EditorContextMenu.vue';
import EditorLaneDeleteButton from './EditorLaneDeleteButton.vue';
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    shallowRef,
    watch,
    type ComponentPublicInstance,
} from 'vue';
import { useAudioSessionService } from '../audio/audioSessionService';
import { EDITOR_CONTEXT_PAN_THRESHOLD_PX } from '../editor/editorConfig';
import {
    addRangeInnerClass,
    createRangeEvent,
    deleteRangeEvent,
    nextRangeCell,
    rangeCellAtTime,
    rangeInnerClassEventCount,
    rangeLaneInnerClasses,
    removeRangeInnerClass,
    renameRangeInnerClass,
    renameRangeLane,
    updateRangeEvent,
    visibleRangeEvents,
} from '../editor/rangeAnnotations';
import { movePointCell, type PointCell } from '../editor/pointAnnotations';
import {
    markerBlockEventCount,
    selectMarkerBlockByMeasures,
    type MarkerBlockSelection,
} from '../editor/markerBlockOperations';
import { generateTempoGrid } from '../editor/tempoMap';
import {
    centerEditorViewport,
    editorTimeToX,
    editorXToTime,
    normalizeEditorViewport,
    panEditorViewportByPixels,
} from '../editor/timeline';
import type {
    EditorProjectV1,
    InnerClassV1,
    RangeEventV1,
    RangeLaneV1,
} from '../editor/types';
import type { PlaybackSnapshot } from '../types/audio';
import type { PersistedTimelineViewport } from '../types/session';

const props = defineProps<{
    project: EditorProjectV1;
    playback: PlaybackSnapshot;
    blockMode: boolean;
    blockSelection: MarkerBlockSelection | null;
    blockPreview: MarkerBlockSelection | null;
}>();
const emit = defineEmits<{
    updateProject: [project: EditorProjectV1, immediate: boolean];
    status: [message: string];
    selectBlock: [selection: MarkerBlockSelection];
    previewBlockMove: [selection: MarkerBlockSelection | null];
    commitBlockMove: [selection: MarkerBlockSelection, targetStartSeconds: number];
}>();

const audioSession = useAudioSessionService();
const rangeLanes = computed(() => props.project.lanes.filter(
    (lane): lane is RangeLaneV1 => lane.eventKind === 'range',
));
const viewport = computed(() => normalizeEditorViewport(
    props.project.workspace.viewport,
    props.project.track.durationSeconds,
));
const surfaceRefs = new Map<string, HTMLElement>();
const gridCanvasRefs = new Map<string, HTMLCanvasElement>();
const rangeRefs = new Map<string, HTMLButtonElement>();
const visibleSurfaceKeys = ref(new Set<string>());
const dialogElement = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;

const surfaceKey = (laneId: string, innerClassId: string) => `${laneId}\u0000${innerClassId}`;
const elementValue = (
    element: Element | ComponentPublicInstance | null,
): HTMLElement | null => element instanceof HTMLElement ? element : null;

const applyProject = (project: EditorProjectV1, immediate = true) => {
    emit('updateProject', project, immediate);
};
const report = (message: string) => emit('status', message);
const formatTime = (seconds: number) => {
    const minutes = Math.floor(Math.max(0, seconds) / 60);
    return `${minutes}:${(Math.max(0, seconds) % 60).toFixed(3).padStart(6, '0')}`;
};
const formatDuration = (range: RangeEventV1) =>
    `${Math.max(0, range.endSeconds - range.startSeconds).toFixed(3)}s`;
const displayedBlockSelection = computed(() => props.blockPreview ?? props.blockSelection);
const blockSelectionCount = computed(() => {
    const selection = props.blockSelection ?? displayedBlockSelection.value;
    if (!selection) return 0;
    try {
        return markerBlockEventCount(props.project, selection);
    } catch {
        return 0;
    }
});
const blockSelectionLabel = computed(() => {
    const selection = displayedBlockSelection.value;
    return selection
        ? `${formatTime(selection.startSeconds)}–${formatTime(selection.endSeconds)}`
        : '';
});
const blockSelectionFor = (laneId: string, innerClassId: string) => {
    const selection = displayedBlockSelection.value;
    return selection?.laneId === laneId && selection.innerClassId === innerClassId
        ? selection
        : null;
};
const blockSelectionStyle = (laneId: string, innerClassId: string) => {
    const selection = blockSelectionFor(laneId, innerClassId);
    if (!selection) return {};
    const left = Math.max(0, Math.min(100, viewportPercent(selection.startSeconds)));
    const right = Math.max(0, Math.min(100, viewportPercent(selection.endSeconds)));
    return { left: `${left}%`, right: `${Math.max(0, 100 - right)}%` };
};

const setSurfaceRef = (
    laneId: string,
    innerClassId: string,
    element: Element | ComponentPublicInstance | null,
) => {
    const key = surfaceKey(laneId, innerClassId);
    const value = elementValue(element);
    const previous = surfaceRefs.get(key);
    if (previous === value) return;
    if (previous) resizeObserver?.unobserve(previous);
    if (previous) intersectionObserver?.unobserve(previous);
    if (!value) {
        surfaceRefs.delete(key);
        if (visibleSurfaceKeys.value.has(key)) {
            const next = new Set(visibleSurfaceKeys.value);
            next.delete(key);
            visibleSurfaceKeys.value = next;
        }
        return;
    }
    surfaceRefs.set(key, value);
    resizeObserver?.observe(value);
    intersectionObserver?.observe(value);
};
const setGridCanvasRef = (
    laneId: string,
    innerClassId: string,
    element: Element | ComponentPublicInstance | null,
) => {
    const key = surfaceKey(laneId, innerClassId);
    const value = elementValue(element);
    if (value instanceof HTMLCanvasElement) gridCanvasRefs.set(key, value);
    else gridCanvasRefs.delete(key);
};
const setRangeRef = (
    eventId: string,
    element: Element | ComponentPublicInstance | null,
) => {
    const value = elementValue(element);
    if (value instanceof HTMLButtonElement) rangeRefs.set(eventId, value);
    else rangeRefs.delete(eventId);
};
const surfaceWidth = (laneId: string, innerClassId: string) =>
    Math.max(1, surfaceRefs.get(surfaceKey(laneId, innerClassId))
        ?.getBoundingClientRect().width ?? 1);
const focusSurface = (laneId: string, innerClassId: string) => {
    void nextTick(() => surfaceRefs.get(surfaceKey(laneId, innerClassId))?.focus());
};
const focusRangeElement = (eventId: string) => {
    void nextTick(() => rangeRefs.get(eventId)?.focus());
};

const laneNameDrafts = reactive<Record<string, string>>({});
const innerClassNameDrafts = reactive<Record<string, string>>({});
const captureLaneNameDraft = (laneId: string, event: Event) => {
    laneNameDrafts[laneId] = (event.target as HTMLInputElement).value;
};
const captureInnerClassNameDraft = (innerClassId: string, event: Event) => {
    innerClassNameDrafts[innerClassId] = (event.target as HTMLInputElement).value;
};
const commitInputOnEnter = (event: KeyboardEvent) => {
    (event.currentTarget as HTMLInputElement).blur();
};
const restoreInput = (event: Event, value: string) => {
    (event.target as HTMLInputElement).value = value;
};
const commitLaneName = (laneId: string, event: Event) => {
    const lane = rangeLanes.value.find((entry) => entry.id === laneId);
    if (!lane) return;
    try {
        applyProject(renameRangeLane(
            props.project,
            laneId,
            laneNameDrafts[laneId] ?? (event.target as HTMLInputElement).value,
        ));
        delete laneNameDrafts[laneId];
        report('范围轨道名称已保存。');
    } catch (error) {
        delete laneNameDrafts[laneId];
        restoreInput(event, lane.name);
        report(error instanceof Error ? error.message : '范围轨道名称无效。');
    }
};
const addInnerClass = (laneId: string) => {
    try {
        applyProject(addRangeInnerClass(props.project, laneId));
        report('已新增范围内部分类。');
    } catch (error) {
        report(error instanceof Error ? error.message : '无法新增范围分类。');
    }
};
const commitInnerClassName = (
    laneId: string,
    innerClassId: string,
    event: Event,
) => {
    const lane = rangeLanes.value.find((entry) => entry.id === laneId);
    const innerClass = lane?.innerClasses.find((entry) => entry.id === innerClassId);
    if (!innerClass) return;
    try {
        applyProject(renameRangeInnerClass(
            props.project,
            laneId,
            innerClassId,
            innerClassNameDrafts[innerClassId]
                ?? (event.target as HTMLInputElement).value,
        ));
        delete innerClassNameDrafts[innerClassId];
        report('范围分类名称已保存。');
    } catch (error) {
        delete innerClassNameDrafts[innerClassId];
        restoreInput(event, innerClass.label);
        report(error instanceof Error ? error.message : '范围分类名称无效。');
    }
};

interface RemovalDialogState {
    laneId: string;
    innerClassId: string;
    label: string;
    eventCount: number;
    targetInnerClassId: string;
    error: string;
}
const removalDialog = ref<RemovalDialogState | null>(null);
const removalTargets = computed(() => {
    const state = removalDialog.value;
    const lane = state ? rangeLanes.value.find((entry) => entry.id === state.laneId) : null;
    return lane?.innerClasses.filter((entry) => entry.id !== state?.innerClassId) ?? [];
});
const requestInnerClassRemoval = (lane: RangeLaneV1, innerClass: InnerClassV1) => {
    const eventCount = rangeInnerClassEventCount(props.project, lane.id, innerClass.id);
    if (eventCount === 0) {
        try {
            applyProject(removeRangeInnerClass(props.project, lane.id, innerClass.id));
            report(`已删除范围分类 ${innerClass.label}。`);
        } catch (error) {
            report(error instanceof Error ? error.message : '无法删除范围分类。');
        }
        return;
    }
    removalDialog.value = {
        laneId: lane.id,
        innerClassId: innerClass.id,
        label: innerClass.label,
        eventCount,
        targetInnerClassId: lane.innerClasses.find((entry) => entry.id !== innerClass.id)?.id ?? '',
        error: '',
    };
    void nextTick(() => dialogElement.value?.focus());
};
const closeRemovalDialog = () => { removalDialog.value = null; };
const confirmMigration = () => {
    const state = removalDialog.value;
    if (!state) return;
    try {
        applyProject(removeRangeInnerClass(props.project, state.laneId, state.innerClassId, {
            kind: 'migrate',
            targetInnerClassId: state.targetInnerClassId,
        }));
        report(`已迁移 ${state.eventCount} 个范围并删除分类。`);
        closeRemovalDialog();
    } catch (error) {
        state.error = error instanceof Error ? error.message : '范围迁移失败。';
    }
};
const confirmEventDeletion = () => {
    const state = removalDialog.value;
    if (!state) return;
    try {
        applyProject(removeRangeInnerClass(props.project, state.laneId, state.innerClassId, {
            kind: 'delete-events',
        }));
        report(`已删除 ${state.eventCount} 个范围和分类。`);
        closeRemovalDialog();
    } catch (error) {
        state.error = error instanceof Error ? error.message : '范围删除失败。';
    }
};

const candidate = ref<{
    laneId: string;
    innerClassId: string;
    timeSeconds: number;
} | null>(null);
const pending = ref<{
    laneId: string;
    innerClassId: string;
    startCell: PointCell;
} | null>(null);
const isActiveCandidate = (laneId: string, innerClassId: string) =>
    candidate.value?.laneId === laneId && candidate.value.innerClassId === innerClassId;
const isPendingSurface = (laneId: string, innerClassId: string) =>
    pending.value?.laneId === laneId && pending.value.innerClassId === innerClassId;
const cellFor = (laneId: string, innerClassId: string): PointCell | null => {
    const active = candidate.value;
    if (!active || active.laneId !== laneId || active.innerClassId !== innerClassId) return null;
    return rangeCellAtTime(
        active.timeSeconds,
        props.project,
        surfaceWidth(laneId, innerClassId),
    );
};
const candidateFor = (laneId: string, innerClassId: string) => cellFor(laneId, innerClassId);
const viewportPercent = (seconds: number) =>
    (seconds - viewport.value.startSeconds)
    / Math.max(1e-9, viewport.value.endSeconds - viewport.value.startSeconds) * 100;
const candidateStyle = (laneId: string, innerClassId: string) => {
    const cell = cellFor(laneId, innerClassId);
    if (!cell) return {};
    return {
        left: `${viewportPercent(cell.startSeconds)}%`,
        right: `${100 - viewportPercent(cell.endSeconds)}%`,
    };
};
const minimumEnd = (
    laneId: string,
    innerClassId: string,
    startSeconds: number,
): PointCell | null => nextRangeCell(
    startSeconds,
    props.project,
    surfaceWidth(laneId, innerClassId),
);
const previewFor = (laneId: string, innerClassId: string) => {
    const state = pending.value;
    const endCell = cellFor(laneId, innerClassId);
    if (!state || !endCell || state.laneId !== laneId || state.innerClassId !== innerClassId) {
        return null;
    }
    const minimum = minimumEnd(laneId, innerClassId, state.startCell.timeSeconds);
    let valid = Boolean(minimum && endCell.timeSeconds >= minimum.timeSeconds);
    if (valid && minimum) {
        try {
            createRangeEvent(
                props.project,
                laneId,
                innerClassId,
                state.startCell.timeSeconds,
                endCell.timeSeconds,
                () => '__preview__',
                minimum.timeSeconds,
            );
        } catch {
            valid = false;
        }
    }
    return { start: state.startCell.timeSeconds, end: endCell.timeSeconds, valid };
};
const previewStyle = (laneId: string, innerClassId: string) => {
    const preview = previewFor(laneId, innerClassId);
    if (!preview) return {};
    const left = viewportPercent(Math.min(preview.start, preview.end));
    const right = viewportPercent(Math.max(preview.start, preview.end));
    return {
        left: `${Math.max(0, left)}%`,
        right: `${Math.max(0, 100 - Math.min(100, right))}%`,
    };
};
const visibleEvents = (lane: RangeLaneV1, innerClassId: string) =>
    visibleSurfaceKeys.value.has(surfaceKey(lane.id, innerClassId))
        || focusedRange?.laneId === lane.id
            && focusedRange.innerClassId === innerClassId
        ? visibleRangeEvents(lane, innerClassId, viewport.value)
        : [];
type Endpoint = 'start' | 'end';
interface HandleDragState {
    id: number;
    laneId: string;
    innerClassId: string;
    range: RangeEventV1;
    endpoint: Endpoint;
    element: HTMLButtonElement;
    candidateCell: PointCell | null;
}
const handleDrag = ref<HandleDragState | null>(null);
const previewRange = (range: RangeEventV1): RangeEventV1 => {
    const active = handleDrag.value;
    if (!active || active.range.id !== range.id || !active.candidateCell) return range;
    return {
        ...range,
        ...(active.endpoint === 'start'
            ? { startSeconds: active.candidateCell.timeSeconds }
            : { endSeconds: active.candidateCell.timeSeconds }),
    };
};
const isHandlePreview = (range: RangeEventV1) =>
    handleDrag.value?.range.id === range.id && Boolean(handleDrag.value.candidateCell);
const rangeStyle = (range: RangeEventV1) => {
    const displayed = previewRange(range);
    return {
        left: `${Math.max(0, viewportPercent(displayed.startSeconds))}%`,
        right: `${Math.max(0, 100 - Math.min(100, viewportPercent(displayed.endSeconds)))}%`,
    };
};
const endpointVisible = (seconds: number) =>
    seconds >= viewport.value.startSeconds && seconds <= viewport.value.endSeconds;
const endpointStyle = (range: RangeEventV1, endpoint: Endpoint) => {
    const displayed = previewRange(range);
    const seconds = endpoint === 'start'
        ? displayed.startSeconds
        : displayed.endSeconds;
    return { left: `${viewportPercent(seconds)}%` };
};

const activateCell = (
    laneId: string,
    innerClassId: string,
    cell: PointCell | null,
) => {
    if (!cell) {
        candidate.value = null;
        report('当前 Tempo 区间还没有 BPM，请先输入 BPM。');
        return;
    }
    candidate.value = { laneId, innerClassId, timeSeconds: cell.timeSeconds };
};
const activateInitialCandidate = (laneId: string, innerClassId: string) => {
    if (isActiveCandidate(laneId, innerClassId)) return;
    const cursor = props.playback.currentTimeSeconds;
    const raw = cursor >= viewport.value.startSeconds && cursor <= viewport.value.endSeconds
        ? cursor
        : viewport.value.startSeconds;
    activateCell(
        laneId,
        innerClassId,
        rangeCellAtTime(raw, props.project, surfaceWidth(laneId, innerClassId)),
    );
};
const pointFromSurface = (event: PointerEvent) => {
    const element = event.currentTarget as HTMLElement;
    const bounds = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
    const timeSeconds = editorXToTime(x, viewport.value, bounds.width);
    return {
        element,
        x,
        y,
        timeSeconds,
        cell: rangeCellAtTime(
            timeSeconds,
            props.project,
            bounds.width,
        ),
    };
};

interface SurfacePointerState {
    id: number;
    laneId: string;
    innerClassId: string;
    surfaceKey: string;
    element: HTMLElement;
    button: number;
    startX: number;
    startViewport: PersistedTimelineViewport;
    latestViewport: PersistedTimelineViewport;
    moved: boolean;
    pendingAtStart: boolean;
    action: 'normal' | 'select-block' | 'move-block';
    anchorSeconds?: number;
    dragOffsetSeconds?: number;
    selectionAtStart?: MarkerBlockSelection;
    targetStartSeconds?: number;
}
const surfacePointer = shallowRef<SurfacePointerState | null>(null);
const quickMenu = ref<{
    surfaceKey: string;
    x: number;
    y: number;
    timeSeconds: number;
} | null>(null);
const onSurfacePointerDown = (
    event: PointerEvent,
    laneId: string,
    innerClassId: string,
) => {
    if (event.button !== 0 && event.button !== 2) return;
    quickMenu.value = null;
    const point = pointFromSurface(event);
    if (props.blockMode) {
        event.preventDefault();
        event.stopPropagation();
        pending.value = null;
        if (event.button === 0) {
            const selection = props.blockSelection;
            if (
                !selection
                || selection.laneId !== laneId
                || selection.innerClassId !== innerClassId
                || point.timeSeconds < selection.startSeconds
                || point.timeSeconds >= selection.endSeconds
            ) {
                report('左键拖动必须从当前选区内开始。');
                return;
            }
            surfacePointer.value = {
                id: event.pointerId,
                laneId,
                innerClassId,
                surfaceKey: surfaceKey(laneId, innerClassId),
                element: point.element,
                button: event.button,
                startX: point.x,
                startViewport: viewport.value,
                latestViewport: viewport.value,
                moved: false,
                pendingAtStart: false,
                action: 'move-block',
                dragOffsetSeconds: point.timeSeconds - selection.startSeconds,
                selectionAtStart: { ...selection },
            };
        } else {
            try {
                emit('selectBlock', selectMarkerBlockByMeasures(
                    props.project,
                    laneId,
                    innerClassId,
                    point.timeSeconds,
                ));
            } catch (error) {
                report(error instanceof Error ? error.message : '无法选择当前小节。');
                return;
            }
            surfacePointer.value = {
                id: event.pointerId,
                laneId,
                innerClassId,
                surfaceKey: surfaceKey(laneId, innerClassId),
                element: point.element,
                button: event.button,
                startX: point.x,
                startViewport: viewport.value,
                latestViewport: viewport.value,
                moved: false,
                pendingAtStart: false,
                action: 'select-block',
                anchorSeconds: point.timeSeconds,
            };
        }
        point.element.setPointerCapture(event.pointerId);
        return;
    }
    if ((event.target as HTMLElement).closest('button, input, select')) return;
    activateCell(laneId, innerClassId, point.cell);
    surfacePointer.value = {
        id: event.pointerId,
        laneId,
        innerClassId,
        surfaceKey: surfaceKey(laneId, innerClassId),
        element: point.element,
        button: event.button,
        startX: point.x,
        startViewport: viewport.value,
        latestViewport: viewport.value,
        moved: false,
        pendingAtStart: Boolean(pending.value),
        action: 'normal',
    };
    point.element.setPointerCapture(event.pointerId);
};
const onSurfacePointerMove = (event: PointerEvent) => {
    const active = surfacePointer.value;
    if (!active) {
        const element = event.currentTarget as HTMLElement;
        const laneId = element.dataset.laneId;
        const innerClassId = element.dataset.innerClassId;
        if (laneId && innerClassId) activateCell(laneId, innerClassId, pointFromSurface(event).cell);
        return;
    }
    if (active.id !== event.pointerId) return;
    const point = pointFromSurface(event);
    if (active.action === 'select-block') {
        try {
            emit('selectBlock', selectMarkerBlockByMeasures(
                props.project,
                active.laneId,
                active.innerClassId,
                active.anchorSeconds ?? point.timeSeconds,
                point.timeSeconds,
            ));
        } catch (error) {
            report(error instanceof Error ? error.message : '无法扩展小节选区。');
        }
        return;
    }
    if (active.action === 'move-block') {
        const selection = active.selectionAtStart;
        if (!selection) return;
        if (Math.abs(point.x - active.startX) < EDITOR_CONTEXT_PAN_THRESHOLD_PX) return;
        active.moved = true;
        const rawTarget = point.timeSeconds - (active.dragOffsetSeconds ?? 0);
        const cell = rangeCellAtTime(
            rawTarget,
            props.project,
            point.element.getBoundingClientRect().width,
        );
        if (!cell) {
            active.targetStartSeconds = undefined;
            emit('previewBlockMove', null);
            return;
        }
        const length = selection.endSeconds - selection.startSeconds;
        const targetEnd = cell.timeSeconds + length;
        if (targetEnd > props.project.track.durationSeconds) {
            active.targetStartSeconds = undefined;
            emit('previewBlockMove', null);
            return;
        }
        active.targetStartSeconds = cell.timeSeconds;
        emit('previewBlockMove', {
            ...selection,
            startSeconds: cell.timeSeconds,
            endSeconds: targetEnd,
        });
        return;
    }
    if (active.button === 2) {
        if (active.pendingAtStart) return;
        if (Math.abs(point.x - active.startX) >= EDITOR_CONTEXT_PAN_THRESHOLD_PX) {
            active.moved = true;
        }
        if (active.moved) {
            active.latestViewport = panEditorViewportByPixels(
                active.startViewport,
                props.project.track.durationSeconds,
                point.x - active.startX,
                point.element.getBoundingClientRect().width,
            );
            applyProject({
                ...props.project,
                workspace: { ...props.project.workspace, viewport: active.latestViewport },
            }, false);
        }
        return;
    }
    activateCell(active.laneId, active.innerClassId, point.cell);
};
const clearSurfacePointer = () => {
    const active = surfacePointer.value;
    surfacePointer.value = null;
    if (active?.element.hasPointerCapture(active.id)) {
        active.element.releasePointerCapture(active.id);
    }
};
const cancelPending = (message = '已取消待选范围。') => {
    if (!pending.value) return;
    pending.value = null;
    report(message);
};
const cancelSurfacePointer = () => {
    const active = surfacePointer.value;
    if (!active) return;
    if (active.action !== 'normal') {
        emit('previewBlockMove', null);
        clearSurfacePointer();
        return;
    }
    if (active?.moved) {
        applyProject({
            ...props.project,
            workspace: { ...props.project.workspace, viewport: active.startViewport },
        });
    }
    if (active?.pendingAtStart) cancelPending();
    clearSurfacePointer();
    quickMenu.value = null;
};
const advanceRangeCreation = (laneId: string, innerClassId: string) => {
    if (props.blockMode) return;
    const cell = cellFor(laneId, innerClassId);
    if (!cell) {
        report('当前 Tempo 区间还没有可用网格。');
        return;
    }
    const state = pending.value;
    if (!state) {
        const next = minimumEnd(laneId, innerClassId, cell.timeSeconds);
        if (!next || next.timeSeconds <= cell.timeSeconds) {
            report('此位置之后没有可用的范围终点。');
            return;
        }
        pending.value = { laneId, innerClassId, startCell: cell };
        report(`已选择起点 ${formatTime(cell.timeSeconds)}，请选择更晚的终点。`);
        return;
    }
    if (state.laneId !== laneId || state.innerClassId !== innerClassId) {
        report('请在同一范围分类中选择终点，或按 Esc 取消。');
        return;
    }
    const minimum = minimumEnd(laneId, innerClassId, state.startCell.timeSeconds);
    if (!minimum || cell.timeSeconds < minimum.timeSeconds) {
        report('终点必须晚于起点至少一个当前网格单位。');
        return;
    }
    try {
        const result = createRangeEvent(
            props.project,
            laneId,
            innerClassId,
            state.startCell.timeSeconds,
            cell.timeSeconds,
            undefined,
            minimum.timeSeconds,
        );
        pending.value = null;
        applyProject(result.project);
        report(`已创建 ${formatTime(result.event.startSeconds)} 至 ${formatTime(result.event.endSeconds)} 的范围。`);
        focusRangeElement(result.event.id);
    } catch (error) {
        report(error instanceof Error ? error.message : '无法创建范围。');
    }
};
const onSurfacePointerUp = (event: PointerEvent) => {
    const active = surfacePointer.value;
    if (!active || active.id !== event.pointerId) return;
    const point = pointFromSurface(event);
    if (active.action === 'select-block') {
        clearSurfacePointer();
        return;
    }
    if (active.action === 'move-block') {
        if (!active.moved) {
            // A click inside the selection keeps it selected without committing.
        } else if (active.selectionAtStart && active.targetStartSeconds !== undefined) {
            emit('commitBlockMove', active.selectionAtStart, active.targetStartSeconds);
        } else {
            report('目标区间不可用，标记保持原位。');
        }
        emit('previewBlockMove', null);
        clearSurfacePointer();
        return;
    }
    if (active.button === 0) {
        activateCell(active.laneId, active.innerClassId, point.cell);
        advanceRangeCreation(active.laneId, active.innerClassId);
    } else if (active.pendingAtStart) {
        cancelPending();
    } else if (active.moved) {
        applyProject({
            ...props.project,
            workspace: { ...props.project.workspace, viewport: active.latestViewport },
        });
    } else {
        quickMenu.value = {
            surfaceKey: active.surfaceKey,
            x: point.x,
            y: point.y,
            timeSeconds: editorXToTime(point.x, viewport.value, point.element.clientWidth),
        };
    }
    clearSurfacePointer();
};
const onSurfacePointerLeave = (laneId: string, innerClassId: string) => {
    if (surfacePointer.value || isPendingSurface(laneId, innerClassId)) return;
    if (document.activeElement !== surfaceRefs.get(surfaceKey(laneId, innerClassId))) {
        candidate.value = null;
    }
};

const revealCandidate = (timeSeconds: number) => {
    if (timeSeconds >= viewport.value.startSeconds && timeSeconds <= viewport.value.endSeconds) return;
    applyProject({
        ...props.project,
        workspace: {
            ...props.project.workspace,
            viewport: centerEditorViewport(
                viewport.value,
                props.project.track.durationSeconds,
                timeSeconds,
            ),
        },
    });
};
const moveCandidate = (
    laneId: string,
    innerClassId: string,
    direction: -1 | 1,
) => {
    activateInitialCandidate(laneId, innerClassId);
    const current = candidate.value?.timeSeconds ?? viewport.value.startSeconds;
    const cell = movePointCell(
        current,
        direction,
        props.project,
        surfaceWidth(laneId, innerClassId),
    );
    activateCell(laneId, innerClassId, cell);
    if (cell) revealCandidate(cell.timeSeconds);
};
const switchCandidateRow = (
    laneId: string,
    innerClassId: string,
    direction: -1 | 1,
) => {
    if (pending.value) {
        report('请先完成或取消当前范围。');
        return;
    }
    const rows = rangeLaneInnerClasses(props.project);
    const index = rows.findIndex((entry) =>
        entry.lane.id === laneId && entry.innerClass.id === innerClassId);
    const target = rows[Math.max(0, Math.min(rows.length - 1, index + direction))];
    if (!target) return;
    const timeSeconds = candidate.value?.timeSeconds ?? viewport.value.startSeconds;
    candidate.value = {
        laneId: target.lane.id,
        innerClassId: target.innerClass.id,
        timeSeconds,
    };
    focusSurface(target.lane.id, target.innerClass.id);
};
const onSurfaceKeydown = (
    event: KeyboardEvent,
    laneId: string,
    innerClassId: string,
) => {
    if (event.defaultPrevented || props.blockMode) return;
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateInitialCandidate(laneId, innerClassId);
        advanceRangeCreation(laneId, innerClassId);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        moveCandidate(laneId, innerClassId, event.key === 'ArrowLeft' ? -1 : 1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        switchCandidateRow(laneId, innerClassId, event.key === 'ArrowUp' ? -1 : 1);
    } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const raw = event.key === 'Home' ? 0 : props.project.track.durationSeconds;
        const cell = rangeCellAtTime(
            raw,
            props.project,
            surfaceWidth(laneId, innerClassId),
        );
        activateCell(laneId, innerClassId, cell);
        if (cell) revealCandidate(cell.timeSeconds);
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        if (pending.value) {
            cancelPending();
            return;
        }
        quickMenu.value = {
            surfaceKey: surfaceKey(laneId, innerClassId),
            x: surfaceWidth(laneId, innerClassId) / 2,
            y: 20,
            timeSeconds: candidate.value?.timeSeconds
                ?? (viewport.value.startSeconds + viewport.value.endSeconds) / 2,
        };
    } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelPending();
        candidate.value = null;
        quickMenu.value = null;
        clearSurfacePointer();
    }
};

let focusedRange: {
    laneId: string;
    innerClassId: string;
    eventId: string;
    startSeconds: number;
    endSeconds: number;
} | null = null;
const focusRange = (
    laneId: string,
    innerClassId: string,
    range: RangeEventV1,
) => {
    if (props.blockMode) return;
    focusedRange = {
        laneId,
        innerClassId,
        eventId: range.id,
        startSeconds: range.startSeconds,
        endSeconds: range.endSeconds,
    };
    candidate.value = { laneId, innerClassId, timeSeconds: range.startSeconds };
    report(`已选择 ${formatTime(range.startSeconds)} 至 ${formatTime(range.endSeconds)} 的范围。`);
};
const removeRange = (
    laneId: string,
    innerClassId: string,
    range: RangeEventV1,
) => {
    if (props.blockMode) return;
    try {
        candidate.value = { laneId, innerClassId, timeSeconds: range.startSeconds };
        applyProject(deleteRangeEvent(props.project, laneId, range.id));
        report(`已删除 ${formatTime(range.startSeconds)} 至 ${formatTime(range.endSeconds)} 的范围。`);
        focusedRange = null;
        focusSurface(laneId, innerClassId);
    } catch (error) {
        report(error instanceof Error ? error.message : '无法删除范围。');
    }
};
const onRangeKeydown = (
    event: KeyboardEvent,
    laneId: string,
    innerClassId: string,
    range: RangeEventV1,
) => {
    if (event.defaultPrevented || props.blockMode) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeRange(laneId, innerClassId, range);
    } else if (event.key === 'Escape') {
        event.preventDefault();
        focusSurface(laneId, innerClassId);
    }
};

const beginHandleDrag = (
    event: PointerEvent,
    laneId: string,
    innerClassId: string,
    range: RangeEventV1,
    endpoint: Endpoint,
) => {
    if (props.blockMode) return;
    if (event.button !== 0) return;
    const element = event.currentTarget as HTMLButtonElement;
    handleDrag.value = {
        id: event.pointerId,
        laneId,
        innerClassId,
        range: { ...range },
        endpoint,
        element,
        candidateCell: null,
    };
    element.setPointerCapture(event.pointerId);
};
const handleCellFromPointer = (event: PointerEvent, state: HandleDragState) => {
    const surface = surfaceRefs.get(surfaceKey(state.laneId, state.innerClassId));
    if (!surface) return null;
    const bounds = surface.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    return rangeCellAtTime(
        editorXToTime(x, viewport.value, bounds.width),
        props.project,
        bounds.width,
    );
};
const moveHandleDrag = (event: PointerEvent) => {
    const state = handleDrag.value;
    if (!state || state.id !== event.pointerId) return;
    state.candidateCell = handleCellFromPointer(event, state);
};
const clearHandleDrag = () => {
    const state = handleDrag.value;
    handleDrag.value = null;
    if (state?.element.hasPointerCapture(state.id)) {
        state.element.releasePointerCapture(state.id);
    }
};
const commitEndpoint = (
    laneId: string,
    innerClassId: string,
    range: RangeEventV1,
    endpoint: Endpoint,
    cell: PointCell,
) => {
    const start = endpoint === 'start' ? cell.timeSeconds : range.startSeconds;
    const end = endpoint === 'end' ? cell.timeSeconds : range.endSeconds;
    const minimum = minimumEnd(laneId, innerClassId, start);
    if (!minimum) {
        report('此起点之后没有可用的范围终点。');
        return false;
    }
    try {
        applyProject(updateRangeEvent(
            props.project,
            laneId,
            range.id,
            start,
            end,
            minimum.timeSeconds,
        ));
        report(`范围${endpoint === 'start' ? '起点' : '终点'}已调整到 ${formatTime(cell.timeSeconds)}。`);
        focusRangeElement(range.id);
        return true;
    } catch (error) {
        report(error instanceof Error ? error.message : '无法调整范围端点。');
        return false;
    }
};
const finishHandleDrag = (event: PointerEvent) => {
    const state = handleDrag.value;
    if (!state || state.id !== event.pointerId) return;
    const cell = state.candidateCell ?? handleCellFromPointer(event, state);
    if (cell) commitEndpoint(
        state.laneId,
        state.innerClassId,
        state.range,
        state.endpoint,
        cell,
    );
    clearHandleDrag();
};
const cancelHandleDrag = () => {
    const state = handleDrag.value;
    if (!state) return;
    report('已取消端点调整，范围保持原值。');
    clearHandleDrag();
};
const onHandleKeydown = (
    event: KeyboardEvent,
    laneId: string,
    innerClassId: string,
    range: RangeEventV1,
    endpoint: Endpoint,
) => {
    if (event.defaultPrevented || props.blockMode) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeRange(laneId, innerClassId, range);
        return;
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        cancelHandleDrag();
        focusRangeElement(range.id);
        return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const current = endpoint === 'start' ? range.startSeconds : range.endSeconds;
    const cell = movePointCell(
        current,
        event.key === 'ArrowLeft' ? -1 : 1,
        props.project,
        surfaceWidth(laneId, innerClassId),
    );
    if (cell) commitEndpoint(laneId, innerClassId, range, endpoint, cell);
};

const menuSeek = (play: boolean) => {
    if (props.blockMode) return;
    const time = quickMenu.value?.timeSeconds;
    quickMenu.value = null;
    if (time === undefined) return;
    void audioSession.seek(time).then(() => {
        if (play && props.playback.state !== 'playing') return audioSession.togglePlayback();
        return undefined;
    });
};
const menuCenter = () => {
    if (props.blockMode) return;
    const time = quickMenu.value?.timeSeconds;
    quickMenu.value = null;
    if (time === undefined) return;
    applyProject({
        ...props.project,
        workspace: {
            ...props.project.workspace,
            viewport: centerEditorViewport(
                viewport.value,
                props.project.track.durationSeconds,
                time,
            ),
        },
    });
};

const drawGrid = (canvas: HTMLCanvasElement) => {
    const surface = canvas.parentElement;
    if (!surface) return;
    const bounds = surface.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    for (const line of generateTempoGrid(
        props.project.tempoMap,
        props.project.track.durationSeconds,
        viewport.value,
    )) {
        const x = editorTimeToX(line.timeSeconds, viewport.value, width);
        context.beginPath();
        context.moveTo(Math.round(x) + 0.5, 0);
        context.lineTo(Math.round(x) + 0.5, height);
        context.strokeStyle = line.kind === 'measure'
            ? 'rgba(255,255,255,.78)'
            : 'rgba(255,255,255,.22)';
        context.lineWidth = 1;
        context.stroke();
    }
};
const drawAllGrids = () => {
    for (const [key, canvas] of gridCanvasRefs) {
        if (visibleSurfaceKeys.value.has(key)) drawGrid(canvas);
    }
};
const clearInteraction = () => {
    cancelSurfacePointer();
    focusedRange = null;
    cancelHandleDrag();
    pending.value = null;
    candidate.value = null;
    quickMenu.value = null;
    removalDialog.value = null;
};

watch(
    () => [props.project.tempoMap, props.project.workspace.viewport, rangeLanes.value.length],
    () => void nextTick(drawAllGrids),
);
watch(
    () => props.blockMode,
    () => {
        cancelSurfacePointer();
        cancelHandleDrag();
        pending.value = null;
        quickMenu.value = null;
        emit('previewBlockMove', null);
    },
);
watch(
    () => [viewport.value.startSeconds, viewport.value.endSeconds],
    () => {
        if (!focusedRange) return;
        const visible = focusedRange.endSeconds >= viewport.value.startSeconds
            && focusedRange.startSeconds <= viewport.value.endSeconds;
        if (!visible) {
            candidate.value = {
                laneId: focusedRange.laneId,
                innerClassId: focusedRange.innerClassId,
                timeSeconds: focusedRange.startSeconds,
            };
            focusSurface(focusedRange.laneId, focusedRange.innerClassId);
            focusedRange = null;
        }
    },
);
onMounted(() => {
    resizeObserver = new ResizeObserver(() => drawAllGrids());
    intersectionObserver = new IntersectionObserver((entries) => {
        const next = new Set(visibleSurfaceKeys.value);
        for (const entry of entries) {
            const surface = entry.target as HTMLElement;
            const laneId = surface.dataset.laneId;
            const innerClassId = surface.dataset.innerClassId;
            if (!laneId || !innerClassId) continue;
            const key = surfaceKey(laneId, innerClassId);
            if (entry.isIntersecting) next.add(key);
            else next.delete(key);
        }
        visibleSurfaceKeys.value = next;
        void nextTick(drawAllGrids);
    }, { rootMargin: '0px' });
    for (const surface of surfaceRefs.values()) {
        resizeObserver.observe(surface);
        intersectionObserver.observe(surface);
    }
    window.addEventListener('blur', clearInteraction);
    void nextTick(drawAllGrids);
});
onBeforeUnmount(() => {
    clearInteraction();
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    window.removeEventListener('blur', clearInteraction);
});
</script>

<style scoped>
.range-workspace { position: relative; }
.range-lane-card {
    margin-top: 0;
    border-bottom: 1px solid var(--hairline);
    border-radius: 0;
    overflow: hidden;
    box-shadow: none;
}
.range-lane-grid {
    display: grid;
    grid-template-columns: var(--editor-lane-name-width) var(--editor-inner-class-width) minmax(420px, 1fr);
    grid-template-rows: repeat(var(--lane-rows), var(--editor-row-height, 44px));
    min-width: 760px;
}
.range-lane-meta,
.range-inner-class-cell,
.range-dialog-actions { display: flex; align-items: center; }
.range-lane-meta {
    grid-column: 1;
    grid-row: 1 / span var(--lane-rows);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-rows: 26px 12px;
    align-content: center;
    gap: 2px 4px;
    padding: 2px 5px;
    border-right: 1px solid var(--hairline-soft);
    background: var(--editor-rail);
}
.range-lane-meta label { display: none; }
.range-lane-meta input { grid-column: 1; grid-row: 1; min-width: 0; min-height: 26px; height: 26px; }
.range-lane-meta button { grid-column: 2; grid-row: 1; min-height: 26px; height: 26px; padding-inline: 5px; }
.range-lane-meta .editor-lane-delete { grid-column:3; }
.range-lane-kind { grid-column: 1 / -1; grid-row: 2; overflow: hidden; color: var(--accent-soft); font-size: .62rem; letter-spacing: .04em; text-overflow: ellipsis; white-space: nowrap; }
.range-inner-class-cell {
    grid-column: 2;
    gap: 6px;
    padding: 4px;
    border-right: 1px solid var(--hairline-soft);
    border-bottom: 1px solid var(--hairline-faint);
    background: var(--editor-lane);
}
.range-inner-class-cell input { flex: 1 1 auto; min-width: 0; width: auto; }
.range-delete-class { padding-inline: 5px; font-size: .7rem; }
button,
input,
select {
    min-height: var(--editor-control-height, 30px);
    border: 1px solid var(--hairline-focus);
    border-radius: var(--editor-control-radius, 4px);
    padding: 4px 8px;
    color: var(--ink);
    background: var(--editor-control-strong);
}
button:hover:not(:disabled) { border-color: var(--accent-soft); background: var(--editor-control-hover); }
button:focus-visible,
input:focus-visible,
select:focus-visible,
.range-surface:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: 2px; }
button:disabled { opacity: .4; cursor: not-allowed; }
.range-surface {
    position: relative;
    grid-column: 3;
    min-height: var(--editor-row-height, 44px);
    overflow: hidden;
    border-bottom: 1px solid var(--hairline-faint);
    background: var(--editor-row-stripe);
    cursor: crosshair;
    touch-action: none;
    user-select: none;
}
.range-surface.is-block-mode { cursor: cell; }
.range-grid-canvas { position: absolute; inset: 0; pointer-events: none; }
.marker-block-selection {
    position: absolute;
    z-index: 3;
    top: 2px;
    bottom: 2px;
    min-width: 2px;
    overflow: hidden;
    border: 1px solid var(--marker-bloom-strong);
    background: var(--marker-fill-soft);
    pointer-events: none;
}
.marker-block-selection.is-preview {
    border-style: dashed;
    background: var(--marker-fill);
}
.marker-block-selection > span {
    position: absolute;
    top: 2px;
    left: 4px;
    overflow: hidden;
    max-width: calc(100% - 8px);
    color: var(--ink);
    font-size: .62rem;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.range-candidate {
    position: absolute;
    z-index: 2;
    top: 3px;
    bottom: 23px;
    min-width: 5px;
    border: 1px solid var(--marker-bloom-strong);
    border-radius: 7px;
    background: var(--marker-fill-soft);
    pointer-events: none;
    transition: transform 120ms ease, background 120ms ease;
}
.range-preview {
    position: absolute;
    z-index: 3;
    top: 3px;
    bottom: 23px;
    min-width: 4px;
    border: 1px dashed var(--accent-bright);
    border-radius: 4px;
    background: var(--marker-fill);
    box-shadow: 0 0 16px var(--marker-glow);
    pointer-events: none;
}
.range-preview.is-invalid { border-color: var(--error); background: var(--error-hairline); }
.range-marker {
    position: absolute;
    z-index: 4;
    top: 3px;
    bottom: 23px;
    min-width: 4px;
    min-height: 0;
    padding: 0 6px;
    overflow: hidden;
    border: 1px solid var(--accent-bright);
    border-radius: 4px;
    color: var(--ink);
    background: var(--marker-ring);
    box-shadow: 0 0 14px var(--marker-fill);
    font: .68rem ui-monospace, monospace;
    white-space: nowrap;
}
.range-marker:hover,
.range-marker:focus-visible { background: var(--marker-bloom); box-shadow: 0 0 20px var(--marker-ring); }
.range-marker.is-handle-preview {
    border-style: dashed;
    background: var(--marker-glow);
}
.range-handle {
    position: absolute;
    z-index: 6;
    bottom: 0;
    width: 24px;
    height: 20px;
    min-height: 20px;
    padding: 0;
    border-radius: var(--editor-control-radius, 4px);
    transform: translateX(-50%);
    cursor: ew-resize;
    touch-action: none;
}
.range-handle.start { color: var(--accent-bright); }
.range-handle.end { color: var(--ink); }
.range-menu {
    position: absolute;
    z-index: 12;
    display: grid;
    min-width: 165px;
    padding: 6px;
    border: 1px solid var(--hairline-focus);
    border-radius: var(--editor-flyout-radius, 8px);
    background: var(--editor-menu);
    box-shadow: 0 14px 40px rgba(0,0,0,.5);
}
.range-menu button { border: 0; text-align: left; }
.range-dialog-backdrop {
    position: fixed;
    z-index: 80;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 20px;
    background: var(--editor-modal-backdrop);
}
.range-removal-dialog {
    width: min(520px, 100%);
    border: 1px solid var(--hairline-focus);
    border-radius: var(--editor-flyout-radius, 8px);
    padding: 18px;
    color: var(--ink);
    background: var(--surface-2);
    box-shadow: 0 20px 70px rgba(0,0,0,.65);
}
.range-removal-dialog h3 { margin: 0 0 10px; }
.range-removal-dialog label { display: grid; gap: 6px; margin-top: 16px; }
.range-dialog-actions { flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.range-dialog-error { color: var(--error); }
.danger { border-color: var(--error); color: var(--error); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (prefers-reduced-motion: reduce) {
    .range-candidate { transition: none; }
}
</style>
