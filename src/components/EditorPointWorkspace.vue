<template>
    <section ref="workspace" class="point-workspace" data-testid="editor-point-workspace" data-editor-major-region="true" aria-labelledby="point-workspace-title">
        <header class="workspace-heading">
            <div class="workspace-titleline">
                <span class="workspace-kicker">Point & Range</span>
                <h2 id="point-workspace-title">点与范围标记轨道</h2>
                <span class="workspace-help">按共享节拍网格标记音符、音色和效果。</span>
            </div>
            <div class="workspace-actions">
                <button type="button" data-testid="add-point-lane" @click="addLane">
                    ＋ 新增点标记轨道
                </button>
                <button type="button" data-testid="add-range-lane" @click="addRangeLane">
                    ＋ 新增范围标记轨道
                </button>
            </div>
        </header>

        <p class="workspace-status" aria-live="polite" data-testid="point-workspace-status">
            {{ liveMessage || `当前 ${pointLanes.length} 条点轨道、${pointCount} 个点；${rangeLanes.length} 条范围轨道、${rangeCount} 个范围` }}
        </p>

        <EditorAnalysisOverlay
            :project="project"
            :playback="playback"
            :analysis="analysis"
            :series="overlaySeries"
            :exact-value="overlayExactValue"
            :overlay-open="overlayOpen"
            @update-project="applyProject"
            @toggle="emit('toggleOverlay', $event)"
            @select-feature="emit('selectOverlayFeature', $event)"
            @retry="emit('retryOverlay')"
        />

        <div v-if="pointLanes.length === 0 && rangeLanes.length === 0" class="empty-workspace">
            <strong>还没有标记轨道</strong>
            <span>选择新增点或范围轨道开始。每条新轨道会包含一个 default 分类。</span>
        </div>

        <article
            v-for="lane in pointLanes"
            :key="lane.id"
            class="lane-card"
            :data-testid="`point-lane-${lane.id}`"
        >
            <div class="lane-grid" :style="{ '--lane-rows': lane.innerClasses.length }">
                <div class="lane-meta">
                    <label :for="`lane-name-${lane.id}`">名称</label>
                    <input
                        :id="`lane-name-${lane.id}`"
                        :value="laneNameDrafts[lane.id] ?? lane.name"
                        :data-testid="`point-lane-name-${lane.id}`"
                        @input="captureLaneNameDraft(lane.id, $event)"
                        @blur="commitLaneName(lane.id, $event)"
                        @keydown.enter.prevent="commitInputOnEnter"
                    >
                    <span class="lane-kind">point · {{ lane.events.length }} 个标记</span>
                    <button
                        type="button"
                        :data-testid="`add-inner-class-${lane.id}`"
                        @click="addInnerClass(lane.id)"
                    >
                        ＋ 分类
                    </button>
                </div>

                <template v-for="(innerClass, innerIndex) in lane.innerClasses" :key="innerClass.id">
                    <div class="inner-class-cell" :style="{ gridRow: innerIndex + 1 }">
                        <label class="sr-only" :for="`inner-name-${innerClass.id}`">
                            {{ lane.name }} 的内部分类
                        </label>
                        <input
                            :id="`inner-name-${innerClass.id}`"
                            :value="innerClassNameDrafts[innerClass.id] ?? innerClass.label"
                            :data-testid="`inner-class-name-${innerClass.id}`"
                            @input="captureInnerClassNameDraft(innerClass.id, $event)"
                            @blur="commitInnerClassName(lane.id, innerClass.id, $event)"
                            @keydown.enter.prevent="commitInputOnEnter"
                        >
                        <button
                            type="button"
                            class="delete-class"
                            :disabled="lane.innerClasses.length <= 1"
                            :aria-label="`删除分类 ${innerClass.label}`"
                            :data-testid="`delete-inner-class-${innerClass.id}`"
                            @click="requestInnerClassRemoval(lane, innerClass)"
                        >
                            删除
                        </button>
                    </div>

                    <div
                        :ref="(element) => setSurfaceRef(lane.id, innerClass.id, element)"
                        class="marker-surface"
                        :class="{ 'is-candidate': isActiveCandidate(lane.id, innerClass.id) }"
                        :style="{ gridRow: innerIndex + 1 }"
                        :data-testid="`marker-surface-${lane.id}-${innerClass.id}`"
                        :data-lane-id="lane.id"
                        :data-inner-class-id="innerClass.id"
                        tabindex="0"
                        role="application"
                        :aria-label="`${lane.name}，${innerClass.label} 标记区域。左键或回车新建，右键标记删除。`"
                        @contextmenu.prevent
                        @dragstart.prevent
                        @pointerdown="onSurfacePointerDown($event, lane.id, innerClass.id)"
                        @pointermove="onSurfacePointerMove"
                        @pointerup="onSurfacePointerUp"
                        @pointercancel="cancelPointer"
                        @lostpointercapture="cancelPointer"
                        @pointerleave="onSurfacePointerLeave(lane.id, innerClass.id)"
                        @focus="activateInitialCandidate(lane.id, innerClass.id)"
                        @keydown="onSurfaceKeydown($event, lane.id, innerClass.id)"
                    >
                        <canvas
                            :ref="(element) => setGridCanvasRef(lane.id, innerClass.id, element)"
                            class="point-grid-canvas"
                            aria-hidden="true"
                        />
                        <span
                            v-if="candidateFor(lane.id, innerClass.id)"
                            class="point-candidate"
                            :style="candidateStyle(lane.id, innerClass.id)"
                            aria-hidden="true"
                        >
                            <span class="candidate-pin" :style="candidatePinStyle(lane.id, innerClass.id)" />
                        </span>
                        <button
                            v-for="event in visibleEvents(lane, innerClass.id)"
                            :key="event.id"
                            :ref="(element) => setMarkerRef(event.id, element)"
                            type="button"
                            class="point-marker"
                            :style="markerStyle(event.atSeconds)"
                            :data-testid="`point-marker-${event.id}`"
                            :data-point-id="event.id"
                            :aria-label="`${innerClass.label} 标记，${formatTime(event.atSeconds)}；右键或删除键移除`"
                            @click.stop="selectMarker(lane.id, innerClass.id, event.id, event.atSeconds)"
                            @contextmenu.stop.prevent="removePoint(lane.id, innerClass.id, event.id, event.atSeconds)"
                            @focus="focusMarker(lane.id, innerClass.id, event.id, event.atSeconds)"
                            @keydown="onMarkerKeydown($event, lane.id, innerClass.id, event.id, event.atSeconds)"
                        >
                            <span aria-hidden="true" />
                        </button>

                        <div
                            v-if="quickMenu?.surfaceKey === surfaceKey(lane.id, innerClass.id)"
                            class="point-menu"
                            role="menu"
                            :style="{ left: `${quickMenu.x}px`, top: `${quickMenu.y}px` }"
                            data-testid="editor-point-menu"
                        >
                            <button type="button" role="menuitem" @click.stop="menuSeek(false)">跳到此处</button>
                            <button type="button" role="menuitem" @click.stop="menuSeek(true)">从此处播放</button>
                            <button type="button" role="menuitem" @click.stop="menuCenter">将此处居中</button>
                        </div>
                    </div>
                </template>
            </div>
        </article>

        <EditorRangeWorkspace
            :project="project"
            :playback="playback"
            @update-project="applyProject"
            @status="report"
        />

        <div v-if="removalDialog" class="dialog-backdrop" @pointerdown.self="closeRemovalDialog">
            <section
                ref="dialogElement"
                class="removal-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="remove-class-title"
                tabindex="-1"
                @keydown.esc.prevent="closeRemovalDialog"
            >
                <h3 id="remove-class-title">处理分类中的标记</h3>
                <p>
                    “{{ removalDialog.label }}”中有 {{ removalDialog.eventCount }} 个标记。
                    请选择迁移到其他分类，或明确删除这些标记。
                </p>
                <label>
                    迁移目标
                    <select v-model="removalDialog.targetInnerClassId" data-testid="inner-class-migration-target">
                        <option
                            v-for="target in removalTargets"
                            :key="target.id"
                            :value="target.id"
                        >
                            {{ target.label }}
                        </option>
                    </select>
                </label>
                <p v-if="removalDialog.error" class="dialog-error" role="alert">
                    {{ removalDialog.error }}
                </p>
                <div class="dialog-actions">
                    <button type="button" data-testid="confirm-inner-class-migration" @click="confirmMigration">
                        迁移并删除分类
                    </button>
                    <button type="button" class="danger" data-testid="confirm-inner-class-event-deletion" @click="confirmEventDeletion">
                        删除标记与分类
                    </button>
                    <button type="button" data-testid="cancel-inner-class-removal" @click="closeRemovalDialog">
                        取消
                    </button>
                </div>
            </section>
        </div>
    </section>
</template>

<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
    type ComponentPublicInstance,
} from 'vue';
import EditorAnalysisOverlay from './EditorAnalysisOverlay.vue';
import EditorRangeWorkspace from './EditorRangeWorkspace.vue';
import { useAudioSessionService } from '../audio/audioSessionService';
import type {
    AnalysisCoordinatorSnapshot,
    AnalysisCursorValueResult,
    AnalysisSeries,
    FeatureId,
} from '../analysis/types';
import {
    addPointInnerClass,
    createPointEvent,
    createPointLane,
    deletePointEvent,
    findPointAt,
    movePointCell,
    pointCellAtTime,
    pointInnerClassEventCount,
    pointLaneInnerClasses,
    removePointInnerClass,
    renamePointInnerClass,
    renamePointLane,
    visiblePointEvents,
    type PointCell,
} from '../editor/pointAnnotations';
import { createRangeLane } from '../editor/rangeAnnotations';
import { EDITOR_CONTEXT_PAN_THRESHOLD_PX } from '../editor/editorConfig';
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
    PointLaneV1,
    RangeLaneV1,
} from '../editor/types';
import type { PlaybackSnapshot } from '../types/audio';
import type { PersistedTimelineViewport } from '../types/session';

const props = defineProps<{
    project: EditorProjectV1;
    playback: PlaybackSnapshot;
    analysis: AnalysisCoordinatorSnapshot;
    overlaySeries: AnalysisSeries | null;
    overlayExactValue: AnalysisCursorValueResult | null;
    overlayOpen: boolean;
}>();

const emit = defineEmits<{
    updateProject: [project: EditorProjectV1, immediate: boolean];
    retryOverlay: [];
    toggleOverlay: [enabled: boolean];
    selectOverlayFeature: [featureId: FeatureId];
}>();

const audioSession = useAudioSessionService();
const workspace = ref<HTMLElement | null>(null);
const dialogElement = ref<HTMLElement | null>(null);
const pointLanes = computed(() => props.project.lanes.filter(
    (lane): lane is PointLaneV1 => lane.eventKind === 'point',
));
const rangeLanes = computed(() => props.project.lanes.filter(
    (lane): lane is RangeLaneV1 => lane.eventKind === 'range',
));
const pointCount = computed(() => pointLanes.value.reduce(
    (total, lane) => total + lane.events.length,
    0,
));
const rangeCount = computed(() => rangeLanes.value.reduce(
    (total, lane) => total + lane.events.length,
    0,
));
const viewport = computed(() => normalizeEditorViewport(
    props.project.workspace.viewport,
    props.project.track.durationSeconds,
));
const liveMessage = ref('');
const candidate = ref<{
    laneId: string;
    innerClassId: string;
    timeSeconds: number;
} | null>(null);
const surfaceRefs = new Map<string, HTMLElement>();
const markerRefs = new Map<string, HTMLButtonElement>();
const gridCanvasRefs = new Map<string, HTMLCanvasElement>();
const visibleSurfaceKeys = ref(new Set<string>());
let resizeObserver: ResizeObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let focusedMarker: {
    laneId: string;
    innerClassId: string;
    eventId: string;
    timeSeconds: number;
} | null = null;

const surfaceKey = (laneId: string, innerClassId: string) =>
    `${laneId}\u0000${innerClassId}`;
const elementValue = (
    element: Element | ComponentPublicInstance | null,
): HTMLElement | null => element instanceof HTMLElement ? element : null;

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

const setMarkerRef = (
    eventId: string,
    element: Element | ComponentPublicInstance | null,
) => {
    const value = elementValue(element);
    if (value instanceof HTMLButtonElement) markerRefs.set(eventId, value);
    else markerRefs.delete(eventId);
};

const formatTime = (seconds: number) => {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${(safe % 60).toFixed(3).padStart(6, '0')}`;
};

const report = (message: string) => {
    liveMessage.value = message;
};

const applyProject = (project: EditorProjectV1, immediate = true) => {
    emit('updateProject', project, immediate);
};

const addLane = () => {
    const project = createPointLane(props.project);
    const lane = project.lanes[project.lanes.length - 1];
    applyProject(project);
    report(`已新增 ${lane?.name ?? '点标记轨道'}。`);
};

const addRangeLane = () => {
    const project = createRangeLane(props.project);
    const lane = project.lanes[project.lanes.length - 1];
    applyProject(project);
    report(`已新增 ${lane?.name ?? '范围标记轨道'}。`);
};

const restoreInput = (event: Event, value: string) => {
    (event.target as HTMLInputElement).value = value;
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

const commitLaneName = (laneId: string, event: Event) => {
    const lane = pointLanes.value.find((entry) => entry.id === laneId);
    if (!lane) return;
    try {
        applyProject(renamePointLane(
            props.project,
            laneId,
            laneNameDrafts[laneId] ?? (event.target as HTMLInputElement).value,
        ));
        delete laneNameDrafts[laneId];
        report('轨道名称已保存。');
    } catch (error) {
        delete laneNameDrafts[laneId];
        restoreInput(event, lane.name);
        report(error instanceof Error ? error.message : '轨道名称无效。');
    }
};

const addInnerClass = (laneId: string) => {
    try {
        applyProject(addPointInnerClass(props.project, laneId));
        report('已新增内部分类。');
    } catch (error) {
        report(error instanceof Error ? error.message : '无法新增分类。');
    }
};

const commitInnerClassName = (
    laneId: string,
    innerClassId: string,
    event: Event,
) => {
    const lane = pointLanes.value.find((entry) => entry.id === laneId);
    const innerClass = lane?.innerClasses.find((entry) => entry.id === innerClassId);
    if (!innerClass) return;
    try {
        applyProject(renamePointInnerClass(
            props.project,
            laneId,
            innerClassId,
            innerClassNameDrafts[innerClassId]
                ?? (event.target as HTMLInputElement).value,
        ));
        delete innerClassNameDrafts[innerClassId];
        report('分类名称已保存。');
    } catch (error) {
        delete innerClassNameDrafts[innerClassId];
        restoreInput(event, innerClass.label);
        report(error instanceof Error ? error.message : '分类名称无效。');
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
    const lane = state
        ? pointLanes.value.find((entry) => entry.id === state.laneId)
        : null;
    return lane?.innerClasses.filter((entry) => entry.id !== state?.innerClassId) ?? [];
});

const requestInnerClassRemoval = (lane: PointLaneV1, innerClass: InnerClassV1) => {
    const eventCount = pointInnerClassEventCount(props.project, lane.id, innerClass.id);
    if (eventCount === 0) {
        try {
            applyProject(removePointInnerClass(props.project, lane.id, innerClass.id));
            report(`已删除分类 ${innerClass.label}。`);
        } catch (error) {
            report(error instanceof Error ? error.message : '无法删除分类。');
        }
        return;
    }
    const target = lane.innerClasses.find((entry) => entry.id !== innerClass.id);
    removalDialog.value = {
        laneId: lane.id,
        innerClassId: innerClass.id,
        label: innerClass.label,
        eventCount,
        targetInnerClassId: target?.id ?? '',
        error: '',
    };
    void nextTick(() => dialogElement.value?.focus());
};

const closeRemovalDialog = () => {
    removalDialog.value = null;
};

const confirmMigration = () => {
    const state = removalDialog.value;
    if (!state) return;
    try {
        applyProject(removePointInnerClass(
            props.project,
            state.laneId,
            state.innerClassId,
            { kind: 'migrate', targetInnerClassId: state.targetInnerClassId },
        ));
        report(`已迁移 ${state.eventCount} 个标记并删除分类。`);
        closeRemovalDialog();
    } catch (error) {
        state.error = error instanceof Error ? error.message : '迁移失败。';
    }
};

const confirmEventDeletion = () => {
    const state = removalDialog.value;
    if (!state) return;
    try {
        applyProject(removePointInnerClass(
            props.project,
            state.laneId,
            state.innerClassId,
            { kind: 'delete-events' },
        ));
        report(`已删除 ${state.eventCount} 个标记和分类。`);
        closeRemovalDialog();
    } catch (error) {
        state.error = error instanceof Error ? error.message : '删除失败。';
    }
};

const surfaceWidth = (laneId: string, innerClassId: string) =>
    Math.max(1, surfaceRefs.get(surfaceKey(laneId, innerClassId))
        ?.getBoundingClientRect().width ?? 1);

const cellFor = (laneId: string, innerClassId: string): PointCell | null => {
    const active = candidate.value;
    if (
        !active
        || active.laneId !== laneId
        || active.innerClassId !== innerClassId
    ) return null;
    return pointCellAtTime(
        active.timeSeconds,
        props.project,
        surfaceWidth(laneId, innerClassId),
    );
};

const candidateFor = (laneId: string, innerClassId: string) =>
    cellFor(laneId, innerClassId);
const isActiveCandidate = (laneId: string, innerClassId: string) =>
    candidate.value?.laneId === laneId
    && candidate.value.innerClassId === innerClassId;
const viewportPercent = (seconds: number) =>
    (seconds - viewport.value.startSeconds)
    / Math.max(1e-9, viewport.value.endSeconds - viewport.value.startSeconds) * 100;
const markerStyle = (seconds: number) => ({ left: `${viewportPercent(seconds)}%` });
const candidateStyle = (laneId: string, innerClassId: string) => {
    const cell = cellFor(laneId, innerClassId);
    if (!cell) return {};
    return {
        left: `${viewportPercent(cell.startSeconds)}%`,
        right: `${100 - viewportPercent(cell.endSeconds)}%`,
    };
};
const candidatePinStyle = (laneId: string, innerClassId: string) => {
    const cell = cellFor(laneId, innerClassId);
    if (!cell) return {};
    const span = Math.max(1e-9, cell.endSeconds - cell.startSeconds);
    return { left: `${(cell.timeSeconds - cell.startSeconds) / span * 100}%` };
};
const visibleEvents = (lane: PointLaneV1, innerClassId: string) =>
    visibleSurfaceKeys.value.has(surfaceKey(lane.id, innerClassId))
        || focusedMarker?.laneId === lane.id
            && focusedMarker.innerClassId === innerClassId
        ? visiblePointEvents(lane, innerClassId, viewport.value)
        : [];

const pointFromPointer = (
    event: PointerEvent,
): { x: number; y: number; cell: PointCell | null; element: HTMLElement } => {
    const element = event.currentTarget as HTMLElement;
    const bounds = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
    return {
        x,
        y,
        element,
        cell: pointCellAtTime(
            editorXToTime(x, viewport.value, bounds.width),
            props.project,
            bounds.width,
        ),
    };
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
        pointCellAtTime(raw, props.project, surfaceWidth(laneId, innerClassId)),
    );
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
}
const pointer = ref<SurfacePointerState | null>(null);
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
    if ((event.target as HTMLElement).closest('button, input, select')) return;
    quickMenu.value = null;
    const point = pointFromPointer(event);
    activateCell(laneId, innerClassId, point.cell);
    pointer.value = {
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
    };
    point.element.setPointerCapture(event.pointerId);
};

const onSurfacePointerMove = (event: PointerEvent) => {
    const active = pointer.value;
    if (!active) {
        const element = event.currentTarget as HTMLElement;
        const laneId = element.dataset.laneId;
        const innerClassId = element.dataset.innerClassId;
        if (!laneId || !innerClassId) return;
        activateCell(laneId, innerClassId, pointFromPointer(event).cell);
        return;
    }
    if (active.id !== event.pointerId) return;
    const point = pointFromPointer(event);
    if (active.button === 2) {
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
                workspace: {
                    ...props.project.workspace,
                    viewport: active.latestViewport,
                },
            }, false);
        }
        return;
    }
    activateCell(active.laneId, active.innerClassId, point.cell);
};

const clearPointer = () => {
    const active = pointer.value;
    pointer.value = null;
    if (active?.element.hasPointerCapture(active.id)) {
        active.element.releasePointerCapture(active.id);
    }
};

const cancelPointer = () => {
    const active = pointer.value;
    if (!active) return;
    if (active?.moved) {
        applyProject({
            ...props.project,
            workspace: {
                ...props.project.workspace,
                viewport: active.startViewport,
            },
        });
    }
    clearPointer();
    quickMenu.value = null;
};

const focusSurface = (laneId: string, innerClassId: string) => {
    void nextTick(() => surfaceRefs.get(surfaceKey(laneId, innerClassId))?.focus());
};

const focusPoint = (eventId: string) => {
    void nextTick(() => markerRefs.get(eventId)?.focus());
};

const createAtCandidate = (laneId: string, innerClassId: string) => {
    const cell = cellFor(laneId, innerClassId);
    if (!cell) {
        report('当前 Tempo 区间还没有可用网格。');
        return;
    }
    const lane = pointLanes.value.find((entry) => entry.id === laneId);
    const existing = lane ? findPointAt(lane, innerClassId, cell.timeSeconds) : null;
    if (existing) {
        report(`此位置已有标记：${formatTime(cell.timeSeconds)}。`);
        focusPoint(existing.id);
        return;
    }
    try {
        const result = createPointEvent(
            props.project,
            laneId,
            innerClassId,
            cell.timeSeconds,
        );
        applyProject(result.project);
        report(`已在 ${formatTime(cell.timeSeconds)} 新建标记。`);
        focusPoint(result.event.id);
    } catch (error) {
        report(error instanceof Error ? error.message : '无法创建标记。');
    }
};

const onSurfacePointerUp = (event: PointerEvent) => {
    const active = pointer.value;
    if (!active || active.id !== event.pointerId) return;
    const point = pointFromPointer(event);
    if (active.button === 0) {
        activateCell(active.laneId, active.innerClassId, point.cell);
        createAtCandidate(active.laneId, active.innerClassId);
    } else if (active.moved) {
        applyProject({
            ...props.project,
            workspace: {
                ...props.project.workspace,
                viewport: active.latestViewport,
            },
        });
    } else {
        quickMenu.value = {
            surfaceKey: active.surfaceKey,
            x: Math.min(point.x, Math.max(0, point.element.clientWidth - 170)),
            y: Math.min(point.y, Math.max(0, point.element.clientHeight - 116)),
            timeSeconds: editorXToTime(
                point.x,
                viewport.value,
                point.element.getBoundingClientRect().width,
            ),
        };
    }
    clearPointer();
};

const onSurfacePointerLeave = (laneId: string, innerClassId: string) => {
    if (pointer.value) return;
    const active = document.activeElement;
    if (active !== surfaceRefs.get(surfaceKey(laneId, innerClassId))) {
        candidate.value = null;
    }
};

const menuSeek = (play: boolean) => {
    const time = quickMenu.value?.timeSeconds;
    quickMenu.value = null;
    if (time === undefined) return;
    void audioSession.seek(time).then(() => {
        if (play && props.playback.state !== 'playing') {
            return audioSession.togglePlayback();
        }
        return undefined;
    });
};

const menuCenter = () => {
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

const revealCandidate = (timeSeconds: number) => {
    if (
        timeSeconds >= viewport.value.startSeconds
        && timeSeconds <= viewport.value.endSeconds
    ) return;
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

const switchCandidateRow = (
    laneId: string,
    innerClassId: string,
    direction: -1 | 1,
) => {
    const rows = pointLaneInnerClasses(props.project);
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

const onSurfaceKeydown = (
    event: KeyboardEvent,
    laneId: string,
    innerClassId: string,
) => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateInitialCandidate(laneId, innerClassId);
        createAtCandidate(laneId, innerClassId);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        moveCandidate(laneId, innerClassId, event.key === 'ArrowLeft' ? -1 : 1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        switchCandidateRow(laneId, innerClassId, event.key === 'ArrowUp' ? -1 : 1);
    } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const raw = event.key === 'Home' ? 0 : props.project.track.durationSeconds;
        const cell = pointCellAtTime(
            raw,
            props.project,
            surfaceWidth(laneId, innerClassId),
        );
        activateCell(laneId, innerClassId, cell);
        if (cell) revealCandidate(cell.timeSeconds);
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        const active = candidate.value?.timeSeconds
            ?? (viewport.value.startSeconds + viewport.value.endSeconds) / 2;
        quickMenu.value = {
            surfaceKey: surfaceKey(laneId, innerClassId),
            x: surfaceWidth(laneId, innerClassId) / 2,
            y: 20,
            timeSeconds: active,
        };
    } else if (event.key === 'Escape') {
        event.preventDefault();
        candidate.value = null;
        quickMenu.value = null;
        clearPointer();
    }
};

const selectMarker = (
    laneId: string,
    innerClassId: string,
    eventId: string,
    timeSeconds: number,
) => {
    focusMarker(laneId, innerClassId, eventId, timeSeconds);
    report(`此位置已有标记，已选择 ${formatTime(timeSeconds)}。`);
};

const focusMarker = (
    laneId: string,
    innerClassId: string,
    eventId: string,
    timeSeconds: number,
) => {
    focusedMarker = { laneId, innerClassId, eventId, timeSeconds };
    candidate.value = { laneId, innerClassId, timeSeconds };
};

const removePoint = (
    laneId: string,
    innerClassId: string,
    eventId: string,
    timeSeconds: number,
) => {
    try {
        candidate.value = { laneId, innerClassId, timeSeconds };
        applyProject(deletePointEvent(props.project, laneId, eventId));
        report(`已删除 ${formatTime(timeSeconds)} 的标记。`);
        focusedMarker = null;
        focusSurface(laneId, innerClassId);
    } catch (error) {
        report(error instanceof Error ? error.message : '无法删除标记。');
    }
};

const onMarkerKeydown = (
    event: KeyboardEvent,
    laneId: string,
    innerClassId: string,
    eventId: string,
    timeSeconds: number,
) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removePoint(laneId, innerClassId, eventId, timeSeconds);
        return;
    }
    if (
        event.key.startsWith('Arrow')
        || event.key === 'Home'
        || event.key === 'End'
        || event.key === 'Escape'
    ) {
        event.preventDefault();
        candidate.value = { laneId, innerClassId, timeSeconds };
        focusSurface(laneId, innerClassId);
        onSurfaceKeydown(event, laneId, innerClassId);
    }
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
    cancelPointer();
    candidate.value = null;
    quickMenu.value = null;
    removalDialog.value = null;
};

watch(
    () => [props.project.tempoMap, props.project.workspace.viewport, pointLanes.value.length],
    () => void nextTick(drawAllGrids),
);

watch(
    () => [viewport.value.startSeconds, viewport.value.endSeconds],
    () => {
        if (!focusedMarker) return;
        const visible = focusedMarker.timeSeconds >= viewport.value.startSeconds
            && focusedMarker.timeSeconds <= viewport.value.endSeconds;
        if (!visible) {
            candidate.value = {
                laneId: focusedMarker.laneId,
                innerClassId: focusedMarker.innerClassId,
                timeSeconds: focusedMarker.timeSeconds,
            };
            focusSurface(focusedMarker.laneId, focusedMarker.innerClassId);
            focusedMarker = null;
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
    if (workspace.value) resizeObserver.observe(workspace.value);
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
.point-workspace {
    position: relative;
    margin-top: 1px;
    border-top: 1px solid var(--editor-divider-strong, rgba(72,255,151,.28));
    border-bottom: 1px solid var(--editor-divider-strong, rgba(72,255,151,.28));
    border-radius: 0;
    padding: 0;
    background: rgba(3, 12, 8, .88);
    --editor-lane-name-width: 152px;
    --editor-inner-class-width: 144px;
}
.workspace-heading,
.workspace-titleline,
.workspace-status,
.lane-meta,
.inner-class-cell,
.range-placeholder,
.dialog-actions {
    display: flex;
    align-items: center;
}
.workspace-heading {
    justify-content: space-between;
    gap: 12px;
    min-height: 40px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--editor-divider, rgba(159,196,175,.16));
}
.workspace-titleline { min-width: 0; gap: 10px; }
.workspace-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.workspace-heading h2 { margin: 0; font-size: .96rem; white-space: nowrap; }
.workspace-kicker { color: #65ffa9; font-size: .68rem; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
.workspace-help { overflow: hidden; color: #779184; font-size: .74rem; text-overflow: ellipsis; white-space: nowrap; }
.workspace-status { min-height: 28px; margin: 0; padding: 4px 8px; border-bottom: 1px solid var(--editor-divider, rgba(159,196,175,.12)); color: #a9c7b6; font-size: .76rem; }
button,
input,
select {
    min-height: var(--editor-control-height, 30px);
    border: 1px solid rgba(101, 255, 169, .48);
    border-radius: var(--editor-control-radius, 4px);
    padding: 4px 8px;
    color: #effff6;
    background: rgba(7, 24, 15, .94);
}
button:hover:not(:disabled) { border-color: #65ffa9; background: rgba(19,69,42,.9); }
button:focus-visible,
input:focus-visible,
select:focus-visible,
.marker-surface:focus-visible { outline: 2px solid #65ffa9; outline-offset: 2px; }
button:disabled { opacity: .4; cursor: not-allowed; }
.empty-workspace {
    display: grid;
    gap: 6px;
    margin: 0;
    border-bottom: 1px dashed rgba(101,255,169,.24);
    border-radius: 0;
    padding: 12px 8px;
    color: #a9c7b6;
}
.lane-card {
    margin-top: 0;
    border-bottom: 1px solid var(--editor-divider-strong, rgba(101,255,169,.22));
    border-radius: 0;
    overflow: hidden;
    box-shadow: none;
}
.lane-grid {
    display: grid;
    grid-template-columns: var(--editor-lane-name-width) var(--editor-inner-class-width) minmax(420px, 1fr);
    grid-template-rows: repeat(var(--lane-rows), var(--editor-row-height, 44px));
    min-width: 760px;
}
.lane-meta {
    grid-column: 1;
    grid-row: 1 / span var(--lane-rows);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: 26px 12px;
    align-content: center;
    gap: 2px 4px;
    padding: 2px 5px;
    border-right: 1px solid rgba(101,255,169,.18);
    background: rgba(4,17,10,.82);
}
.lane-meta label { display: none; }
.lane-meta input { grid-column: 1; grid-row: 1; min-width: 0; min-height: 26px; height: 26px; }
.lane-meta button { grid-column: 2; grid-row: 1; min-height: 26px; height: 26px; padding-inline: 5px; }
.lane-kind { grid-column: 1 / -1; grid-row: 2; overflow: hidden; color: #65ffa9; font-size: .62rem; letter-spacing: .04em; text-overflow: ellipsis; white-space: nowrap; }
.inner-class-cell {
    grid-column: 2;
    gap: 6px;
    padding: 4px;
    border-right: 1px solid rgba(101,255,169,.18);
    border-bottom: 1px solid rgba(101,255,169,.12);
    background: rgba(5,20,12,.78);
}
.inner-class-cell input { flex: 1 1 auto; min-width: 0; width: auto; }
.delete-class { padding-inline: 5px; font-size: .7rem; }
.marker-surface {
    position: relative;
    grid-column: 3;
    min-height: var(--editor-row-height, 44px);
    overflow: hidden;
    border-bottom: 1px solid rgba(101,255,169,.12);
    background: rgba(0,0,0,.18);
    cursor: crosshair;
    touch-action: none;
    user-select: none;
}
.point-grid-canvas { position: absolute; inset: 0; pointer-events: none; }
.point-candidate {
    position: absolute;
    z-index: 2;
    top: 5px;
    bottom: 5px;
    min-width: 6px;
    border: 1px solid rgba(101,255,169,.92);
    border-radius: 8px;
    background: rgba(101,255,169,.12);
    box-shadow: 0 0 14px rgba(71,255,151,.16);
    pointer-events: none;
    transform: scaleY(1.04);
    transition: transform 120ms ease, background 120ms ease;
}
.candidate-pin { position: absolute; top: 0; bottom: 0; width: 1px; background: #eafff2; transform: translateX(-50%); }
.point-marker {
    position: absolute;
    z-index: 4;
    top: 50%;
    width: 24px;
    height: 34px;
    padding: 0;
    border: 0;
    background: transparent;
    transform: translate(-50%, -50%);
    overflow: visible;
}
.point-marker > span {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 14px;
    height: 14px;
    border: 2px solid #caffdf;
    background: #35ff8f;
    box-shadow: 0 0 0 3px rgba(53,255,143,.16), 0 0 18px rgba(53,255,143,.62);
    transform: translate(-50%, -65%) rotate(45deg);
}
.point-marker > span::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 100%;
    width: 2px;
    height: 14px;
    background: #caffdf;
    transform: translateX(-50%) rotate(-45deg);
    transform-origin: top;
}
.point-marker:focus-visible > span,
.point-marker:hover > span { background: #eafff2; box-shadow: 0 0 0 4px rgba(53,255,143,.25), 0 0 22px #35ff8f; }
.point-menu {
    position: absolute;
    z-index: 12;
    display: grid;
    min-width: 165px;
    padding: 6px;
    border: 1px solid rgba(101,255,169,.5);
    border-radius: var(--editor-flyout-radius, 8px);
    background: rgba(2,10,6,.98);
    box-shadow: 0 14px 40px rgba(0,0,0,.5);
}
.point-menu button { border: 0; text-align: left; }
.dialog-backdrop {
    position: fixed;
    z-index: 80;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(0,0,0,.7);
}
.removal-dialog {
    width: min(520px, 100%);
    border: 1px solid rgba(101,255,169,.5);
    border-radius: var(--editor-flyout-radius, 8px);
    padding: 18px;
    color: #effff6;
    background: #041009;
    box-shadow: 0 20px 70px rgba(0,0,0,.65);
}
.removal-dialog h3 { margin: 0 0 10px; color: #fff; }
.removal-dialog label { display: grid; gap: 6px; margin-top: 16px; }
.dialog-actions { flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.dialog-error { margin-top: 10px; color: #ffb0a8; }
.danger { border-color: rgba(255,120,110,.7); color: #ffd4cf; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (max-width: 900px) {
    .point-workspace { overflow-x: auto; }
    .workspace-heading { min-width: 760px; align-items: flex-start; flex-wrap: wrap; }
    .workspace-help { display: none; }
}
@media (prefers-reduced-motion: reduce) {
    .point-candidate { transition: none; transform: none; }
}
</style>
