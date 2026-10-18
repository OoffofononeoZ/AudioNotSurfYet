/** One frame per workspace, shared by all visible row canvases and the ruler. */
export function createMarkerDrawing() {
    const pending = new Set<() => void>();
    let frame = 0, disposed = false;
    return {
        request(draw: () => void) {
            if (disposed) return;
            pending.add(draw);
            if (!frame) frame = requestAnimationFrame(() => {
                frame = 0; const jobs = [...pending]; pending.clear(); jobs.forEach(job => job());
            });
        },
        remove(draw: () => void) { pending.delete(draw); },
        dispose() { disposed = true; if (frame) cancelAnimationFrame(frame); frame = 0; pending.clear(); },
    };
}
export type MarkerDrawing = ReturnType<typeof createMarkerDrawing>;
