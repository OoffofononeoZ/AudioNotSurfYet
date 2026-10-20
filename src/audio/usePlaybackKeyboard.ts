import { onBeforeUnmount, onMounted } from 'vue';
import type { AudioSessionService } from './audioSessionService';

const editingSelector =
    'input,textarea,select,[role="textbox"],[role="searchbox"],[role="combobox"],[role="spinbutton"]';

function isEditing(event: KeyboardEvent): boolean {
    return event
        .composedPath()
        .some(
            target =>
                target instanceof Element &&
                (target.matches(editingSelector) || (target instanceof HTMLElement && target.isContentEditable)),
        );
}

export function usePlaybackKeyboard(audio: Pick<AudioSessionService, 'togglePlayback'>): void {
    let handled = false;
    const consume = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
    };
    const down = (event: KeyboardEvent) => {
        if (event.code !== 'Space') return;
        if (handled) {
            consume(event);
            return;
        }
        if (
            event.repeat ||
            event.isComposing ||
            event.shiftKey ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            isEditing(event)
        )
            return;
        handled = true;
        consume(event);
        void audio.togglePlayback();
    };
    const up = (event: KeyboardEvent) => {
        if (event.code !== 'Space' || !handled) return;
        consume(event);
        handled = false;
    };
    const reset = () => {
        handled = false;
    };
    const visibility = () => {
        if (document.hidden) reset();
    };

    onMounted(() => {
        // Capture before focused buttons and local Space handlers can run.
        window.addEventListener('keydown', down, true);
        window.addEventListener('keyup', up, true);
        window.addEventListener('blur', reset);
        document.addEventListener('visibilitychange', visibility);
    });
    onBeforeUnmount(() => {
        window.removeEventListener('keydown', down, true);
        window.removeEventListener('keyup', up, true);
        window.removeEventListener('blur', reset);
        document.removeEventListener('visibilitychange', visibility);
        reset();
    });
}
