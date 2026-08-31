export interface MasonryItemSize<TId extends PropertyKey = number> {
    id: TId;
    height: number;
}

export interface MasonryPlacement<TId extends PropertyKey = number> {
    id: TId;
    column: number;
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface MasonryLayout<TId extends PropertyKey = number> {
    columnWidth: number;
    height: number;
    placements: MasonryPlacement<TId>[];
}

export interface MasonryLayoutInput<TId extends PropertyKey = number> {
    containerWidth: number;
    columnCount: 1 | 2;
    gap: number;
    items: readonly MasonryItemSize<TId>[];
}

export const calculateMasonryLayout = <TId extends PropertyKey>({
    containerWidth,
    columnCount,
    gap,
    items,
}: MasonryLayoutInput<TId>): MasonryLayout<TId> => {
    const safeWidth = Math.max(0, containerWidth);
    const safeGap = Math.max(0, gap);
    const columnWidth = Math.max(
        0,
        (safeWidth - safeGap * (columnCount - 1)) / columnCount,
    );
    const columnHeights = Array.from({ length: columnCount }, () => 0);
    const placements = items.map((item) => {
        const height = Math.max(0, item.height);
        let column = 0;
        for (let index = 1; index < columnHeights.length; index += 1) {
            if (columnHeights[index]! < columnHeights[column]!) {
                column = index;
            }
        }
        const placement: MasonryPlacement<TId> = {
            id: item.id,
            column,
            left: column * (columnWidth + safeGap),
            top: columnHeights[column]!,
            width: columnWidth,
            height,
        };
        columnHeights[column] = placement.top + height + safeGap;
        return placement;
    });
    const height = items.length === 0
        ? 0
        : Math.max(...columnHeights) - safeGap;
    return {
        columnWidth,
        height: Math.max(0, height),
        placements,
    };
};
