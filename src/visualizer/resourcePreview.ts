import { resourceFile, resourcePath } from './resourceFiles';
import type { LocalDirectoryReference } from '../platform/fileContracts';
import { joinDirectoryPath, type DirectoryFileAccess } from '../platform/directoryFiles';
import { browserDirectoryFiles } from '../platform/webDirectoryFiles';

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
    if (
        doc.querySelector('parsererror') ||
        doc.documentElement.localName !== 'svg' ||
        doc.doctype ||
        doc.createTreeWalker(doc, NodeFilter.SHOW_PROCESSING_INSTRUCTION).nextNode()
    )
        throw Error('资源预览不是有效 SVG。');
    // Static SVG artwork includes paint servers, filters and text, not just primitive shapes.
    const allowed = new Set([
        'svg',
        'g',
        'defs',
        'path',
        'rect',
        'circle',
        'ellipse',
        'line',
        'polyline',
        'polygon',
        'title',
        'desc',
        'text',
        'tspan',
        'textPath',
        'use',
        'linearGradient',
        'radialGradient',
        'stop',
        'clipPath',
        'mask',
        'pattern',
        'marker',
        'filter',
        'feBlend',
        'feColorMatrix',
        'feComponentTransfer',
        'feComposite',
        'feConvolveMatrix',
        'feDiffuseLighting',
        'feDisplacementMap',
        'feDistantLight',
        'feDropShadow',
        'feFlood',
        'feFuncA',
        'feFuncB',
        'feFuncG',
        'feFuncR',
        'feGaussianBlur',
        'feMerge',
        'feMergeNode',
        'feMorphology',
        'feOffset',
        'fePointLight',
        'feSpecularLighting',
        'feSpotLight',
        'feTile',
        'feTurbulence',
    ]);
    const localReference = (value: string) => /^#[^\s"'()\\<>]+$/.test(value) && !!doc.getElementById(value.slice(1));
    for (const node of [doc.documentElement, ...doc.documentElement.querySelectorAll('*')]) {
        if (node.namespaceURI !== 'http://www.w3.org/2000/svg' || !allowed.has(node.localName))
            throw Error('预览必须是独立 SVG 图形。');
        for (const attr of node.attributes) {
            // Keep CSS out of the document; escaped/commented CSS URLs must not bypass reference checks.
            if (/^on|^style$|^base$/i.test(attr.localName) || /\\|\/\*/.test(attr.value))
                throw Error('预览不允许脚本或外部引用。');
            if (attr.localName === 'href' && !localReference(attr.value))
                throw Error('预览只允许引用 SVG 内已有的图形。');
            const remainder = attr.value.replace(/url\s*\(([^)]*)\)/gi, (_url, target: string) => {
                const reference = target.trim().replace(/^(["'])(.*)\1$/, '$2');
                if (!localReference(reference)) throw Error('预览只允许引用 SVG 内已有的图形。');
                return '';
            });
            if (/url\s*\(/i.test(remainder)) throw Error('预览的图形引用无效。');
        }
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
    root: LocalDirectoryReference,
    previewPath: string | undefined,
    signal: AbortSignal,
    decode = decodeImage,
    files: { access: DirectoryFileAccess; path?: string } = { access: browserDirectoryFiles },
): Promise<Blob | null> {
    if (previewPath !== undefined) resourcePath(previewPath);
    const images: string[] = [];
    for (const { name, kind } of await files.access.list(root, files.path ?? '', signal)) {
        signal.throwIfAborted();
        if (kind === 'file' && isResourceImage(name)) images.push(name);
    }
    const priority = (path: string) => (/^cover\./i.test(path) ? 0 : /^preview\./i.test(path) ? 1 : 2);
    images.sort((a, b) => priority(a) - priority(b) || a.localeCompare(b, 'en'));
    const paths = [...new Set([...(previewPath ? [previewPath] : []), ...images])];
    for (const path of paths) {
        signal.throwIfAborted();
        if (!isResourceImage(path)) continue;
        try {
            const file = await resourceFile(root, joinDirectoryPath(files.path ?? '', path), signal, files.access);
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
