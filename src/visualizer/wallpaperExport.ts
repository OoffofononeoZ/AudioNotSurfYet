import { validateRealtimeStyle, realtimeRenderModel, type RealtimeStyleV1 } from './realtimeStyle';
import { inspectRealtimeContent } from './realtimeCapabilities';

export interface WallpaperExportFile {
    name: string;
    content: string;
}
export function createWallpaperFiles(input: RealtimeStyleV1, runtime: string, licenses: string): WallpaperExportFile[] {
    const style = validateRealtimeStyle(input),
        model = realtimeRenderModel(style, 1);
    const capabilities = inspectRealtimeContent(model.elements, style.resources, 1);
    if (!capabilities.wallpaper) throw Error(capabilities.wallpaperIssues.join('\n'));
    if (!runtime.trim() || !licenses.trim()) throw Error('壁纸运行包不完整。');
    const json = JSON.stringify(style)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    return [
        {
            name: 'index.html',
            content:
                '<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AudioSurf</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}canvas{display:block;width:100vw;height:100vh}#error{position:absolute;inset:24px auto auto 24px;max-width:calc(100vw - 72px);padding:12px;color:#fff;background:#18231e;white-space:pre-wrap;font:16px sans-serif}</style></head><body><canvas aria-label="音频可视化"></canvas><div id="error" role="alert" hidden></div><script src="style-data.js"></script><script src="runtime.js"></script></body></html>\n',
        },
        { name: 'style-data.js', content: 'window.__AUDIOSURF_STYLE__=' + json + ';\n' },
        { name: 'runtime.js', content: runtime },
        { name: 'THIRD_PARTY_LICENSES.txt', content: licenses },
        {
            name: 'project.json',
            content:
                JSON.stringify(
                    {
                        title: style.name,
                        description: 'AudioSurf 实时音频可视化',
                        type: 'web',
                        file: 'index.html',
                        supportsaudioprocessing: true,
                    },
                    null,
                    2,
                ) + '\n',
        },
    ];
}
export async function prepareWallpaperFiles(style: RealtimeStyleV1, signal?: AbortSignal) {
    const files = await Promise.all(
        ['runtime.js', 'THIRD_PARTY_LICENSES.txt'].map(async name => {
            const response = await fetch(`${import.meta.env.BASE_URL}wallpaper-runtime/${name}`, { signal });
            if (!response.ok) throw Error('无法读取壁纸运行包，请重新构建或重启开发服务。');
            return response.text();
        }),
    );
    signal?.throwIfAborted();
    return createWallpaperFiles(style, files[0]!, files[1]!);
}
