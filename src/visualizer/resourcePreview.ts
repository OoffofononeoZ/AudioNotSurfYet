import { resourceFile, resourcePath, type ResourceDirectoryHandle } from './resourceFiles';

export const DEFAULT_RESOURCE_PREVIEW = '/default_cover.png';
const imageTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg: 'image/svg+xml',
};
export const isResourceImage = (path: string) =>
    Object.prototype.hasOwnProperty.call(imageTypes, path.split('.').pop()!.toLowerCase());

function previewSvg(source: string): Blob {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg')
        throw Error('资源预览不是有效 SVG。');
    const allowed = new Set([
        'svg',
        'g',
        'path',
        'rect',
        'circle',
        'ellipse',
        'line',
        'polyline',
        'polygon',
        'title',
        'desc',
    ]);
    for (const node of [doc.documentElement, ...doc.documentElement.querySelectorAll('*')]) {
        if (node.namespaceURI !== 'http://www.w3.org/2000/svg' || !allowed.has(node.localName))
            throw Error('预览必须是独立 SVG 图形。');
        for (const attr of node.attributes)
            if (/^on|href|style/i.test(attr.name) || /url\s*\(/i.test(attr.value))
                throw Error('预览不允许脚本或外部引用。');
    }
    return new Blob([source], { type: 'image/svg+xml' });
}

async function decodeImage(blob: Blob, signal: AbortSignal) {
    signal.throwIfAborted();
    const url = URL.createObjectURL(blob),
        image = new Image();
    try {
        await new Promise<void>((resolve, reject) => {
            const abort = () => reject(signal.reason);
            signal.addEventListener('abort', abort, { once: true });
            image.onload = () => {
                signal.removeEventListener('abort', abort);
                if (image.naturalWidth && image.naturalHeight) resolve();
                else reject(Error('封面尺寸无效。'));
            };
            image.onerror = () => {
                signal.removeEventListener('abort', abort);
                reject(Error('无法解码封面。'));
            };
            image.src = url;
        });
        signal.throwIfAborted();
    } finally {
        image.onload = image.onerror = null;
        image.src = '';
        URL.revokeObjectURL(url);
    }
}

/** Optional artwork must not hide resource/permission errors or acquire long-lived URLs. */
export async function readResourcePreview(
    root: ResourceDirectoryHandle,
    previewPath: string | undefined,
    signal: AbortSignal,
    decode = decodeImage,
): Promise<Blob | null> {
    if (previewPath !== undefined) resourcePath(previewPath);
    const files: string[] = [];
    for await (const [name, handle] of root.entries()) {
        signal.throwIfAborted();
        if (handle.kind === 'file' && isResourceImage(name)) files.push(name);
    }
    const priority = (path: string) => (/^cover\./i.test(path) ? 0 : /^preview\./i.test(path) ? 1 : 2);
    files.sort((a, b) => priority(a) - priority(b) || a.localeCompare(b, 'en'));
    const paths = [...new Set([...(previewPath ? [previewPath] : []), ...files])];
    for (const path of paths) {
        signal.throwIfAborted();
        if (!isResourceImage(path)) continue;
        try {
            const file = await resourceFile(root, path, signal);
            const type = imageTypes[path.split('.').pop()!.toLowerCase()]!;
            const blob = type === 'image/svg+xml' ? previewSvg(await file.text()) : new Blob([file], { type });
            await decode(blob, signal);
            signal.throwIfAborted();
            return blob;
        } catch (error) {
            signal.throwIfAborted();
            if (['AbortError', 'NotAllowedError', 'SecurityError'].includes((error as Error).name)) throw error;
            // A missing/corrupt optional image falls through to another image or the player cover.
            if (
                error instanceof DOMException &&
                !['NotFoundError', 'EncodingError', 'TypeMismatchError'].includes(error.name)
            )
                throw error;
        }
    }
    return null;
}
