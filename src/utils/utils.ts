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
 * 将能量值映射为角度(默认为矩形，无圆角)
 * @param energy - 能量值，范围为 0-max
 * @param width - 宽度
 * @param height - 高度
 * @param max - 最大能量值
 * @param power - 幂，仅正数
 * @returns 角度，范围为 180-360
 */
export function mapEnergyToDeg(energy: number, width: number, height: number = 70, power: number = 2, max: number = 100): number {
    if (energy > max) return 360;
    else if (energy < 0) return 180;
    const prog = Math.pow(energy / max, 1 / power) * (width + height);
    if (prog < width / 2) return Math.atan(2 * prog / height) * (180 / Math.PI) + 180;
    else if (prog < (width + height) / 2) return Math.atan(width / (height + width - prog * 2)) * (180 / Math.PI) + 180;
    else if (prog < (width / 2 + height)) return 360 - Math.atan(width / (2 * prog - width - height)) * (180 / Math.PI);
    else return 360 - Math.atan((width + height - prog) / (width / 2)) * (180 / Math.PI);
}

/** 将时间秒数转换为时分秒格式(00:00:00) */
export function formatSecToTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const res = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (hours > 0) return res;
    else return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** 限定输入值在[min, max]范围内 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}