/* Divisor presets, colours and tick hierarchy ported from osu!.
 * Copyright (c) 2025 ppy Pty Ltd <contact@ppy.sh>.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
export type BeatSnapPreset = 'common' | 'triplets' | 'custom';
export interface EditorBeatSnapSetting { preset: BeatSnapPreset; divisor: number; customDivisor: number }
export const DEFAULT_BEAT_SNAP: Readonly<EditorBeatSnapSetting> = { preset: 'common', divisor: 4, customDivisor: 5 };
export const COMMON_DIVISORS = [1, 2, 4, 8, 16];
export const TRIPLET_DIVISORS = [1, 3, 6, 12];
const HIERARCHY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 16];
export function customDivisors(maximum: number): number[] {
    return Array.from({ length: maximum }, (_, index) => index + 1).filter(value => maximum % value === 0);
}
export function snapPresets(setting: EditorBeatSnapSetting): number[] {
    return setting.preset === 'common' ? COMMON_DIVISORS : setting.preset === 'triplets' ? TRIPLET_DIVISORS : customDivisors(setting.customDivisor);
}
export function validateBeatSnap(value: unknown): EditorBeatSnapSetting {
    const setting = value as Partial<EditorBeatSnapSetting> | null;
    if (!setting || !['common', 'triplets', 'custom'].includes(setting.preset ?? '')
        || !Number.isInteger(setting.divisor) || setting.divisor! < 1 || setting.divisor! > 64
        || !Number.isInteger(setting.customDivisor) || setting.customDivisor! < 1 || setting.customDivisor! > 64) throw new Error('节拍细分必须为 1–64 的整数。');
    const result = { preset: setting.preset!, divisor: setting.divisor!, customDivisor: setting.customDivisor! };
    if (!snapPresets(result).includes(result.divisor)) throw new Error('细分不属于所选预设。');
    return result;
}
export function divisorForIndex(index: number, divisor: number): number {
    const beat = index % divisor;
    return HIERARCHY.find(candidate => (beat * candidate) % divisor === 0) ?? 0;
}
export function divisorColour(divisor: number): string {
    return ({ 1: '#ffffff', 2: '#ed1121', 3: '#8866ee', 4: '#66ccff', 5: '#b3d944', 6: '#eeaa00',
        7: '#b3d944', 8: '#ffcc22', 9: '#b3d944', 12: '#cc6600', 16: '#6644cc' } as Record<number, string>)[divisor] ?? '#ff0000';
}
export function divisorHeight(divisor: number): number {
    return divisor === 1 || divisor === 2 ? .9 : divisor === 3 || divisor === 4 ? .8 : divisor === 6 || divisor === 8 ? .7 : .6;
}
