import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import {
    DEFAULT_PINNED_RATIO, MIN_PINNED_RATIO, pinnedPanelBounds, resolvePinnedHeight,
} from '../../analysis/pinnedPanelHeight';

export const usePinnedPanel = (activeCount: Ref<number>) => {
    const workspace = ref<HTMLElement | null>(null);
    const pinnedBody = ref<HTMLElement | null>(null);
    const pinnedScroll = ref<HTMLElement | null>(null);
    const originalList = ref<HTMLElement | null>(null);
    const resizeHandle = ref<HTMLButtonElement | null>(null);
    const availableHeight = ref(0);
    const contentHeight = ref(0);
    const preferredRatio = ref(DEFAULT_PINNED_RATIO);
    let observer: ResizeObserver | null = null;
    let frame: number | null = null;
    let disposed = false;
    const bounds = computed(() => pinnedPanelBounds(availableHeight.value, contentHeight.value));
    const height = computed(() => activeCount.value > 0
        ? resolvePinnedHeight(preferredRatio.value, availableHeight.value, contentHeight.value) : 0);
    const canResize = computed(() => bounds.value.max - bounds.value.min > 1);
    const listHidden = computed(() => availableHeight.value - height.value < 1);
    const percent = (value: number) => availableHeight.value > 0
        ? Math.round(value / availableHeight.value * 100) : 0;
    const ariaValues = computed(() => ({
        'aria-valuemin': percent(bounds.value.min),
        'aria-valuemax': percent(bounds.value.max),
        'aria-valuenow': percent(height.value),
        'aria-valuetext': percent(height.value) + '% 可用工作区高度',
    }));
    const measure = () => {
        frame = null;
        if (disposed) return;
        availableHeight.value = workspace.value?.clientHeight ?? 0;
        contentHeight.value = pinnedBody.value?.getBoundingClientRect().height ?? 0;
    };
    const scheduleMeasure = () => {
        if (!disposed && frame === null) frame = requestAnimationFrame(measure);
    };
    interface Drag {
        pointerId: number;
        element: HTMLButtonElement;
        startY: number;
        startHeight: number;
        startRatio: number;
    }
    let drag: Drag | null = null;
    const dragging = ref(false);
    const finishDrag = (cancel = false) => {
        const current = drag;
        drag = null;
        dragging.value = false;
        if (!current) return;
        if (cancel) preferredRatio.value = current.startRatio;
        if (current.element.hasPointerCapture(current.pointerId)) {
            current.element.releasePointerCapture(current.pointerId);
        }
    };
    const setHeight = (value: number) => {
        if (availableHeight.value <= 0) return;
        const clipped = Math.max(bounds.value.min, Math.min(bounds.value.max, value));
        preferredRatio.value = Math.max(MIN_PINNED_RATIO, Math.min(1, clipped / availableHeight.value));
    };
    const beginDrag = (event: PointerEvent) => {
        if (drag || event.button !== 0 || !canResize.value) return;
        event.preventDefault();
        const element = event.currentTarget as HTMLButtonElement;
        element.focus({ preventScroll: true });
        drag = { pointerId: event.pointerId, element, startY: event.clientY,
            startHeight: height.value, startRatio: preferredRatio.value };
        dragging.value = true;
        element.setPointerCapture(event.pointerId);
    };
    const moveDrag = (event: PointerEvent) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        setHeight(drag.startHeight + event.clientY - drag.startY);
    };
    const endDrag = (event: PointerEvent) => {
        if (drag?.pointerId === event.pointerId) finishDrag();
    };
    const cancelDrag = (event?: Event) => {
        if (event instanceof PointerEvent && drag && event.pointerId !== drag.pointerId) return;
        finishDrag(true);
    };
    const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && drag) {
            event.preventDefault();
            cancelDrag();
            return;
        }
        if (!canResize.value) return;
        let next: number | null = null;
        if (event.key === 'ArrowUp') next = height.value - availableHeight.value * 0.05;
        if (event.key === 'ArrowDown') next = height.value + availableHeight.value * 0.05;
        if (event.key === 'Home') next = bounds.value.min;
        if (event.key === 'End') next = bounds.value.max;
        if (next === null) return;
        event.preventDefault();
        setHeight(next);
    };
    const onGlobalKeydown = (event: KeyboardEvent) => {
        if (drag && event.key === 'Escape') handleKeydown(event);
    };
    watch(activeCount, (count) => {
        if (count === 0) cancelDrag();
        void nextTick(scheduleMeasure);
    }, { flush: 'post' });
    onMounted(() => {
        observer = new ResizeObserver(scheduleMeasure);
        if (workspace.value) observer.observe(workspace.value);
        if (pinnedBody.value) observer.observe(pinnedBody.value);
        scheduleMeasure();
        window.addEventListener('keydown', onGlobalKeydown);
        window.addEventListener('blur', cancelDrag);
    });
    onBeforeUnmount(() => {
        disposed = true;
        finishDrag();
        observer?.disconnect();
        if (frame !== null) cancelAnimationFrame(frame);
        window.removeEventListener('keydown', onGlobalKeydown);
        window.removeEventListener('blur', cancelDrag);
    });
    return { workspace, pinnedBody, pinnedScroll, originalList, resizeHandle, height,
        canResize, listHidden, ariaValues, dragging, beginDrag, moveDrag, endDrag, cancelDrag, handleKeydown };
};
