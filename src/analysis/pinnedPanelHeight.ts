export const PINNED_HANDLE_HEIGHT = 24;
export const DEFAULT_PINNED_RATIO = 0.6;
export const MIN_PINNED_RATIO = 0.4;

export const pinnedPanelBounds = (availableHeight: number, contentHeight: number) => {
    const available = Math.max(0, Number.isFinite(availableHeight) ? availableHeight : 0);
    const content = Math.max(0, Number.isFinite(contentHeight) ? contentHeight : 0);
    const max = Math.min(available, content + PINNED_HANDLE_HEIGHT);
    return { min: Math.min(available * MIN_PINNED_RATIO, max), max };
};

export const resolvePinnedHeight = (ratio: number, availableHeight: number, contentHeight: number) => {
    const bounds = pinnedPanelBounds(availableHeight, contentHeight);
    return Math.max(bounds.min, Math.min(bounds.max, ratio * Math.max(0, availableHeight)));
};
