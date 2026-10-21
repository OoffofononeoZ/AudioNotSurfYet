import { computed, onBeforeUnmount, shallowRef, ref, watch } from 'vue';
import { useEditorSessionController } from './editorSessionController';
import { EditorAnalysisWindowView, windowCovers, type AnalysisWindowViewInput } from './analysisWindowView';
import type { AnalysisWindowSeries, RenderAnalysisSeries } from '../analysis/windowTypes';

export function useAnalysisWindow(input: () => AnalysisWindowViewInput) {
    const controller = useEditorSessionController();
    const detail = shallowRef<AnalysisWindowSeries | null>(null),
        pending = ref(false);
    const view = new EditorAnalysisWindowView(
        (request, signal) => controller.requestAnalysisWindow(request, signal),
        (series, busy) => {
            detail.value = series;
            pending.value = busy;
        },
    );
    watch(input, value => view.update(value), { immediate: true, flush: 'sync' });
    onBeforeUnmount(() => view.dispose());
    const series = computed<RenderAnalysisSeries | null>(() => {
        const context = input(),
            cached = detail.value;
        return context.enabled && cached && windowCovers(cached, context) ? cached : context.series;
    });
    return { series, pending };
}
