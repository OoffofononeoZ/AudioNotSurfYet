import { computed, watch } from 'vue';
import { constrainEditorViewport, editorMeasureSeconds, editorViewportForMeasures, normalizeEditorViewport } from './timeline';
import type { EditorProjectV1 } from './types';
import type { PersistedTimelineViewport } from '../types/session';

const signature = (viewport: PersistedTimelineViewport) => `${viewport.startSeconds.toFixed(6)}:${viewport.endSeconds.toFixed(6)}:${viewport.zoom.toFixed(6)}`;
export function useEditorViewport(project: () => EditorProjectV1, cursor: () => number, publish: (project: EditorProjectV1, immediate: boolean) => void) {
    const viewport = computed(() => normalizeEditorViewport(project().workspace.viewport, project().track.durationSeconds));
    let identity: string | null = null, touched = false, tempoSignature = '', automaticSignature = '';
    function update(next: PersistedTimelineViewport, immediate: boolean, manual = true) {
        if (manual) touched = true;
        else automaticSignature = signature(next);
        publish({ ...project(), workspace: { ...project().workspace, viewport: next } }, immediate);
    }
    function measures(count: number | 'all') {
        const value = project(), duration = value.track.durationSeconds;
        update(count === 'all' ? { startSeconds: 0, endSeconds: duration, zoom: 1 }
            : editorViewportForMeasures(duration, value.tempoMap, count, cursor()), true);
    }
    watch(() => [project().projectId, project().tempoMap, project().workspace.viewport], () => {
        const value = project(), current = viewport.value;
        const hasMeter = editorMeasureSeconds(value.tempoMap, cursor()) !== null;
        const nextTempoSignature = JSON.stringify(value.tempoMap);
        let next = current;
        if (identity !== value.projectId) {
            identity = value.projectId; touched = current.zoom > 1;
            next = touched ? constrainEditorViewport(current, value.track.durationSeconds, value.tempoMap)
                : editorViewportForMeasures(value.track.durationSeconds, value.tempoMap, 4, cursor());
        } else {
            if (signature(current) !== automaticSignature) touched = true;
            if (nextTempoSignature !== tempoSignature && hasMeter && !touched) next = editorViewportForMeasures(value.track.durationSeconds, value.tempoMap, 4, cursor());
            else next = constrainEditorViewport(current, value.track.durationSeconds, value.tempoMap);
        }
        tempoSignature = nextTempoSignature;
        if (signature(next) !== signature(current)) update(next, true, false);
        else if (!automaticSignature) automaticSignature = signature(current);
    }, { immediate: true });
    return { viewport, update, measures };
}
