let closeCurrent: (() => void) | null = null;

/** One menu across the waveform, point and range surfaces. */
export function claimEditorContextMenu(close: () => void): () => void {
    closeCurrent?.();
    closeCurrent = close;
    return () => { if (closeCurrent === close) closeCurrent = null; };
}
