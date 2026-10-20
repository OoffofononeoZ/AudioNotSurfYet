import { validateRealtimeStyle, realtimeRenderModel } from './realtimeStyle';
import { inspectRealtimeContent } from './realtimeCapabilities';
import { RealtimeSurface } from './realtimeSurface';
import { wallpaperAudioValues } from './wallpaperInput';

interface WallpaperHost extends Window {
    __AUDIOSURF_STYLE__?: unknown;
    wallpaperRegisterAudioListener?: (listener: (values: ArrayLike<number>) => void) => void;
    wallpaperPropertyListener?: {
        applyGeneralProperties(properties: { fps?: number }): void;
        setPaused(paused: boolean): void;
    };
}
const host = window as WallpaperHost;
let surface: RealtimeSurface | null = null,
    hostPaused = false,
    failed = false,
    frameRate = 0;
const canvas = document.querySelector<HTMLCanvasElement>('canvas')!,
    error = document.getElementById('error')!;
const fail = (message: string) => {
    failed = true;
    error.textContent = message;
    error.hidden = false;
    surface?.dispose();
    surface = null;
};
const pause = () => surface?.setPaused(hostPaused || document.hidden);
// Register host properties outside load events, before starting the renderer.
host.wallpaperPropertyListener = {
    applyGeneralProperties(properties) {
        if (typeof properties.fps === 'number' && Number.isFinite(properties.fps) && properties.fps >= 0) {
            frameRate = properties.fps;
            surface?.setFrameRate(frameRate);
        }
    },
    setPaused(value) {
        hostPaused = value;
        pause();
    },
};
try {
    const style = validateRealtimeStyle(host.__AUDIOSURF_STYLE__);
    delete host.__AUDIOSURF_STYLE__;
    const model = realtimeRenderModel(style, 1),
        capabilities = inspectRealtimeContent(model.elements, style.resources, 1);
    if (!capabilities.wallpaper) throw Error(capabilities.wallpaperIssues.join('\n'));
    if (typeof host.wallpaperRegisterAudioListener !== 'function')
        throw Error('请将此目录的 index.html 导入 Wallpaper Engine。');
    surface = new RealtimeSurface(canvas, style, status => {
        if (status.state === 'error') fail(status.message ?? '壁纸渲染失败。');
    });
    surface.setFrameRate(frameRate);
    pause();
    host.wallpaperRegisterAudioListener(values => {
        if (failed) return;
        try {
            surface?.setFeatures({ wallpaperEngineSpectrum: wallpaperAudioValues(values) });
        } catch (e) {
            fail((e as Error).message);
        }
    });
} catch (e) {
    fail((e as Error).message);
}
document.addEventListener('visibilitychange', pause);
window.addEventListener('pagehide', () => {
    surface?.dispose();
    surface = null;
    document.removeEventListener('visibilitychange', pause);
});
