import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { generateTempoGrid } from './tempoMap';
import { divisorColour, divisorHeight, type EditorBeatSnapSetting } from './beatSnap';
import { markerTimeToX, type MarkerTimeView } from './markerTimeView';
import type { MarkerDrawing } from './markerDrawing';
import type { EditorProjectV1 } from './types';

export function useMarkerSurfaceDrawing(
    element: Ref<HTMLElement | null>,
    canvas: Ref<HTMLCanvasElement | null>,
    project: () => EditorProjectV1,
    view: () => MarkerTimeView,
    setting: () => EditorBeatSnapSetting,
    drawing: MarkerDrawing,
) {
    const visible = ref(false);
    let resize: ResizeObserver | undefined, intersection: IntersectionObserver | undefined;
    let width = 1,
        height = 48;
    function draw() {
        if (!visible.value || !canvas.value) return;
        const dpr = Math.max(1, devicePixelRatio || 1),
            target = canvas.value;
        if (target.width !== Math.round(width * dpr)) target.width = Math.round(width * dpr);
        if (target.height !== Math.round(height * dpr)) target.height = Math.round(height * dpr);
        const context = target.getContext('2d');
        if (!context) return;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        for (const line of generateTempoGrid(project().tempoMap, view().durationSeconds, view(), setting(), width)) {
            const x = Math.round(markerTimeToX(line.timeSeconds, view(), width)) + 0.5;
            const tickHeight = height * (line.kind === 'beat' ? 1 : divisorHeight(line.divisor));
            context.beginPath();
            context.moveTo(x, (height - tickHeight) / 2);
            context.lineTo(x, (height + tickHeight) / 2);
            context.strokeStyle = divisorColour(line.divisor);
            context.globalAlpha = line.kind === 'beat' ? 0.6 : 0.28;
            context.stroke();
        }
        context.globalAlpha = 0.65;
        context.fillStyle = '#050908';
        const start = Math.max(0, markerTimeToX(0, view(), width)),
            end = Math.min(width, markerTimeToX(view().durationSeconds, view(), width));
        if (start > 0) context.fillRect(0, 0, start, height);
        if (end < width) context.fillRect(Math.max(0, end), 0, width - end, height);
    }
    const request = () => {
        if (visible.value) drawing.request(draw);
    };
    watch(() => [view(), project().tempoMap, setting()], request);
    onMounted(() => {
        resize = new ResizeObserver(([entry]) => {
            if (entry) {
                width = Math.max(1, entry.contentRect.width);
                height = entry.contentRect.height;
                request();
            }
        });
        intersection = new IntersectionObserver(([entry]) => {
            visible.value = Boolean(entry?.isIntersecting);
            if (visible.value) request();
            else drawing.remove(draw);
        });
        if (element.value) {
            resize.observe(element.value);
            intersection.observe(element.value);
        }
    });
    onBeforeUnmount(() => {
        resize?.disconnect();
        intersection?.disconnect();
        drawing.remove(draw);
    });
    return visible;
}
