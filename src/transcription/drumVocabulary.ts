/** ADT_STR GM_custom -> standard GM, pinned to the converter's published table. */
export const ADT_TO_GM: Readonly<Record<number, number>> = {
    35: 35,
    36: 36,
    37: 37,
    38: 38,
    39: 39,
    40: 40,
    41: 41,
    42: 42,
    43: 44,
    44: 46,
    45: 47,
    46: 49,
    47: 50,
    48: 51,
    49: 52,
    50: 54,
    51: 55,
    52: 56,
    53: 58,
    54: 60,
    55: 69,
    56: 71,
    57: 73,
    58: 75,
    59: 78,
    60: 80,
};
export const DRUM_CATEGORIES = [
    'kick',
    'snare',
    'hat',
    'tom',
    'crash',
    'ride',
    'clap',
    'percussion',
    'unknown',
] as const;
export type DrumSoundCategory = (typeof DRUM_CATEGORIES)[number];
export const DRUM_LABELS: Record<DrumSoundCategory, string> = {
    kick: '底鼓',
    snare: '军鼓',
    hat: '踩镲',
    tom: '通鼓',
    crash: '重音镲',
    ride: '叮叮镲',
    clap: '拍手',
    percussion: '其他打击声',
    unknown: '待命名打击声',
};

export function classifyDrumSound(customPitch: number): { category: DrumSoundCategory; gmPitch: number | null } {
    const gmPitch = ADT_TO_GM[customPitch] ?? null;
    if (gmPitch === null) return { category: 'unknown', gmPitch };
    const category: DrumSoundCategory = [35, 36].includes(gmPitch)
        ? 'kick'
        : [37, 38, 40].includes(gmPitch)
          ? 'snare'
          : [42, 44, 46].includes(gmPitch)
            ? 'hat'
            : [41, 43, 45, 47, 48, 50].includes(gmPitch)
              ? 'tom'
              : [49, 52, 55, 57].includes(gmPitch)
                ? 'crash'
                : [51, 53, 59].includes(gmPitch)
                  ? 'ride'
                  : gmPitch === 39
                    ? 'clap'
                    : 'percussion';
    return { category, gmPitch };
}

export function drumSoundKey(category: DrumSoundCategory, customPitch: number): string {
    return category === 'unknown' || category === 'percussion' ? `${category}:${customPitch}` : category;
}
