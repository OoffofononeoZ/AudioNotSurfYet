import { computed } from 'vue';
import { normalizeEditorViewport } from './timeline';
import type { EditorProjectV2 } from './types';
import type { PersistedTimelineViewport } from '../types/session';

export function useEditorViewport(
    project: () => EditorProjectV2,
    publish: (project: EditorProjectV2, immediate: boolean) => void,
) {
    const viewport = computed(() =>
        normalizeEditorViewport(project().workspace.viewport, project().track.durationSeconds),
    );
    function update(next: PersistedTimelineViewport, immediate: boolean) {
        publish({ ...project(), workspace: { ...project().workspace, viewport: next } }, immediate);
    }
    function reset() {
        update(normalizeEditorViewport(null, project().track.durationSeconds), true);
    }
    return { viewport, update, reset };
}
