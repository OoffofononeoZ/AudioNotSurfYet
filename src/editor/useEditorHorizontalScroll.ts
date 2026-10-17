import { onBeforeUnmount, onMounted } from 'vue';

/** Keep physical overflow in sync; musical pan/zoom still belong to the shared viewport. */
export function useEditorHorizontalScroll(): void {
    function sync(event: Event) {
        const source = event.target;
        if (!(source instanceof HTMLElement) || !source.matches('.editor-timeline-panel,.point-workspace') || !source.closest('#editor-marking-panel')) return;
        for (const target of document.querySelectorAll<HTMLElement>('#editor-marking-panel .editor-timeline-panel,#editor-marking-panel .point-workspace')) {
            if (target !== source && Math.abs(target.scrollLeft - source.scrollLeft) > 1) target.scrollLeft = source.scrollLeft;
        }
    }
    onMounted(() => document.addEventListener('scroll',sync,true));
    onBeforeUnmount(() => document.removeEventListener('scroll',sync,true));
}
