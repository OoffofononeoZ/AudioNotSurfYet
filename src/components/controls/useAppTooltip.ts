import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue';

const active = shallowRef<symbol | null>(null);
let revision = 0;

export function useAppTooltip(
    trigger: Ref<HTMLElement | undefined>,
    tooltip: Ref<{ updatePopper(): void } | null>,
    body: Ref<HTMLElement | null>,
    content: () => string,
) {
    const identity = Symbol('tooltip');
    const visible = computed(() => active.value === identity);
    const appendTo = shallowRef<HTMLElement>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cleanup: (() => void) | undefined;
    let hovered = false,
        focused = false,
        reading = false,
        clickedOpen = false,
        pointerWasOpen = false;
    function cancelTimer() {
        clearTimeout(timer);
        timer = undefined;
    }
    function close() {
        cancelTimer();
        clickedOpen = false;
        if (visible.value) active.value = null;
    }
    function dismiss() {
        revision++;
        close();
    }
    function show() {
        revision++;
        cancelTimer();
        const element = trigger.value;
        if (!element?.isConnected || !content().trim()) return;
        appendTo.value =
            element.closest<HTMLElement>('dialog[open], [popover]:popover-open') ??
            (document.fullscreenElement?.contains(element)
                ? (document.fullscreenElement as HTMLElement)
                : document.body);
        active.value = identity;
    }
    function leave() {
        cancelTimer();
        timer = setTimeout(() => {
            if (!hovered && !focused && !reading && !clickedOpen) close();
        }, 150);
    }
    function hover(value: boolean) {
        hovered = value;
        cancelTimer();
        if (value) {
            const request = ++revision;
            timer = setTimeout(() => {
                if (request === revision) show();
            }, 200);
        } else leave();
    }
    function focus(value: boolean) {
        focused = value;
        if (value) show();
        else leave();
    }
    function read(value: boolean) {
        reading = value;
        if (value) cancelTimer();
        else leave();
    }
    function pointerDown() {
        pointerWasOpen = visible.value;
    }
    function click(event: MouseEvent) {
        if (event.detail ? pointerWasOpen : visible.value) dismiss();
        else {
            clickedOpen = true;
            show();
        }
    }
    watch(
        visible,
        value => {
            cleanup?.();
            cleanup = undefined;
            if (!value) {
                cancelTimer();
                clickedOpen = false;
                return;
            }
            const abort = new AbortController();
            const observer = new IntersectionObserver(entries => {
                if (visible.value && entries.some(entry => !entry.isIntersecting)) close();
            });
            if (trigger.value) observer.observe(trigger.value);
            const update = () => tooltip.value?.updatePopper();
            document.addEventListener(
                'pointerdown',
                event => {
                    if (!trigger.value?.contains(event.target as Node) && !body.value?.contains(event.target as Node))
                        dismiss();
                },
                { capture: true, signal: abort.signal },
            );
            document.addEventListener(
                'keydown',
                event => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                        dismiss();
                    }
                },
                { capture: true, signal: abort.signal },
            );
            document.addEventListener('fullscreenchange', dismiss, { signal: abort.signal });
            window.addEventListener('resize', update, { signal: abort.signal });
            window.visualViewport?.addEventListener('resize', update, { signal: abort.signal });
            cleanup = () => {
                abort.abort();
                observer.disconnect();
            };
        },
        { flush: 'post' },
    );
    watch(content, close);
    onBeforeUnmount(() => {
        close();
        cleanup?.();
    });
    return { visible, appendTo, hover, focus, read, pointerDown, click };
}
