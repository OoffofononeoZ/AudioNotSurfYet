import type { LyricFont } from '../visualizer/lyricTypes';
import type { DesktopBridge } from './fileContracts';
export interface LocalFontAccess {
    available(): boolean;
    read(signal: AbortSignal): Promise<LyricFont[]>;
}
export const browserLocalFonts: LocalFontAccess = { available: localFontsAvailable, read: readLocalFonts };
export function desktopLocalFonts(bridge: DesktopBridge['fonts']): LocalFontAccess {
    return {
        available: localFontsAvailable,
        async read(signal) {
            signal.throwIfAborted();
            const result = await bridge.requestAccess();
            signal.throwIfAborted();
            if (!result.ok) throw Error(result.error.message);
            if (!result.value) throw Error('未获准读取本机字体，请允许访问后重试。');
            return readLocalFonts(signal);
        },
    };
}

type FontQuery = () => Promise<LyricFont[]>;
export function localFontsAvailable(): boolean {
    return typeof (globalThis as unknown as { queryLocalFonts?: FontQuery }).queryLocalFonts === 'function';
}
export async function readLocalFonts(signal: AbortSignal): Promise<LyricFont[]> {
    const query = (globalThis as unknown as { queryLocalFonts?: FontQuery }).queryLocalFonts;
    if (!query) throw Error('当前环境不支持读取本机字体。');
    signal.throwIfAborted();
    try {
        const fonts = await query.call(globalThis);
        signal.throwIfAborted();
        if (!fonts.length) throw Error('没有可访问的本机字体，请检查访问权限并刷新页面后重试。');
        return [
            ...new Map(
                fonts.map(f => [
                    f.postscriptName,
                    { family: f.family, fullName: f.fullName, postscriptName: f.postscriptName },
                ]),
            ).values(),
        ].sort((a, b) => a.fullName.localeCompare(b.fullName) || a.postscriptName.localeCompare(b.postscriptName));
    } catch (error) {
        signal.throwIfAborted();
        if ((error as Error).name === 'NotAllowedError')
            throw Error('未获准读取本机字体，请允许访问并刷新页面后重试。');
        throw error;
    }
}
