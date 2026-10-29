import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export const APP_ORIGIN = 'app://audiosurf';

export class AppResourceError extends Error {
    readonly status: number;
    constructor(status: number) {
        super(status === 404 ? 'Resource not found' : 'Request denied');
        this.status = status;
    }
}

const inside = (root: string, target: string) => {
    const relative = path.relative(root, target);
    return (
        relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
    );
};

export function isAppUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'app:' && url.hostname === 'audiosurf' && !url.port && !url.username && !url.password;
    } catch {
        return false;
    }
}

export function isDevelopmentUrl(value: string, origin: string): boolean {
    try {
        const url = new URL(value);
        return url.origin === origin && !url.username && !url.password;
    } catch {
        return false;
    }
}

const pageRoute =
    /^(?:\/|\/analyzer|\/comingsoon|\/testlands|\/(?:editor|visualizer)(?:\/[^/]+)?|\/display\/[^/]+)\/?$/;

/** Resolve only bundled assets and known SPA routes; never turn missing assets into HTML. */
export async function resolveRendererResource(root: string, value: string, method = 'GET'): Promise<string> {
    if (!isAppUrl(value) || !['GET', 'HEAD'].includes(method)) throw new AppResourceError(403);
    let pathname: string;
    try {
        pathname = decodeURIComponent(new URL(value).pathname);
    } catch {
        throw new AppResourceError(400);
    }
    if (/[\\\x00-\x1f]/.test(pathname) || pathname.split('/').some(part => part === '..' || part === '.')) {
        throw new AppResourceError(403);
    }
    const rootPath = await realpath(root);
    const candidate = path.resolve(rootPath, `.${pageRoute.test(pathname) ? '/index.html' : pathname}`);
    if (!inside(rootPath, candidate)) throw new AppResourceError(403);
    try {
        const target = await realpath(candidate);
        if (!inside(rootPath, target) || !(await stat(target)).isFile()) throw new AppResourceError(404);
        return target;
    } catch (error) {
        if (error instanceof AppResourceError) throw error;
        throw new AppResourceError(404);
    }
}

// The algorithm srcdoc retains its own nonce CSP and opaque origin. Its trusted
// inline bootstrap requires inline script permission in the inherited policy.
export const APP_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "frame-src 'self' blob: about:",
    "connect-src 'self' blob: https://huggingface.co https://*.huggingface.co https://*.hf.co",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
].join('; ');
