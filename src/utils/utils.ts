/**
 * 在一维数字数组中找出最大值和最小值，
 * 并将最大值向上取整（Math.ceil），最小值向下取整（Math.floor），
 * 返回 [最小值, 最大值]。
 *
 * @param arr - 输入的一维数字数组
 * @returns [floor(min), ceil(max)]，如果数组为空则返回 [null, null]
 */
export function getRoundedMinMax(arr: Array<number>): [number | null, number | null] {
    if (arr.length === 0) {
        return [null, null];
    }

    let min = Infinity;
    let max = -Infinity;
    for (const val of arr) {
        if (val < min) min = val;
        if (val > max) max = val;
    }
    return [Math.floor(min), Math.ceil(max)];
}

/**
 * 判断当前浏览器是否为edge
 * @returns boolean
 */
export function isEdge() {
    return navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg');
}