import type { BrowserWindow, Rectangle } from 'electron';
import { randomUUID } from 'node:crypto';
import {
    closeSync,
    fsyncSync,
    mkdirSync,
    openSync,
    readFileSync,
    renameSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const WINDOW_MINIMUM = { width: 1024, height: 640 };
export interface WindowState {
    version: 1;
    bounds: Rectangle;
    maximized: boolean;
}
function parseState(value: unknown): WindowState {
    const state = value as WindowState;
    if (
        state?.version !== 1 ||
        typeof state.maximized !== 'boolean' ||
        !state.bounds ||
        !['x', 'y', 'width', 'height'].every(key => Number.isSafeInteger(state.bounds[key as keyof Rectangle])) ||
        state.bounds.width <= 0 ||
        state.bounds.height <= 0
    )
        throw Error('Invalid window state');
    return { version: 1, bounds: { ...state.bounds }, maximized: state.maximized };
}
export function loadWindowState(file: string): WindowState | null {
    try {
        return parseState(JSON.parse(readFileSync(file, 'utf8')));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('Window preferences unavailable');
        return null;
    }
}
export function windowPlacement(saved: WindowState | null, primary: Rectangle, workAreas: Rectangle[]): WindowState {
    const requested = saved?.bounds;
    const overlap = (area: Rectangle) =>
        requested
            ? Math.max(
                  0,
                  Math.min(area.x + area.width, requested.x + requested.width) - Math.max(area.x, requested.x),
              ) *
              Math.max(
                  0,
                  Math.min(area.y + area.height, requested.y + requested.height) - Math.max(area.y, requested.y),
              )
            : 0;
    const area = workAreas.reduce((best, next) => (overlap(next) > overlap(best) ? next : best), primary);
    const width = Math.max(WINDOW_MINIMUM.width, Math.min(requested?.width ?? 1440, area.width));
    const height = Math.max(WINDOW_MINIMUM.height, Math.min(requested?.height ?? 960, area.height));
    const fit = (value: number, start: number, length: number, size: number) =>
        Math.max(start, Math.min(value, start + Math.max(0, length - size)));
    return {
        version: 1,
        bounds: {
            x: fit(requested?.x ?? area.x + Math.floor((area.width - width) / 2), area.x, area.width, width),
            y: fit(requested?.y ?? area.y + Math.floor((area.height - height) / 2), area.y, area.height, height),
            width,
            height,
        },
        maximized: saved?.maximized ?? false,
    };
}
function saveWindowState(file: string, state: WindowState) {
    const temporary = `${file}.${randomUUID()}.tmp`;
    let descriptor: number | undefined,
        created = false;
    try {
        mkdirSync(path.dirname(file), { recursive: true });
        descriptor = openSync(temporary, 'wx', 0o600);
        created = true;
        writeFileSync(descriptor, JSON.stringify(parseState(state)) + '\n', 'utf8');
        fsyncSync(descriptor);
        closeSync(descriptor);
        descriptor = undefined;
        renameSync(temporary, file);
    } catch {
        if (descriptor !== undefined)
            try {
                closeSync(descriptor);
            } catch {}
        if (created)
            try {
                unlinkSync(temporary);
            } catch {}
        console.warn('Window preferences could not be saved');
    }
}
export function trackWindowState(window: BrowserWindow, file: string) {
    const capture = () => {
        if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return;
        saveWindowState(file, { version: 1, bounds: window.getNormalBounds(), maximized: window.isMaximized() });
    };
    // Windows emits moved/resized after the user finishes the operation.
    window.on('moved', capture);
    window.on('resized', capture);
    window.on('maximize', capture);
    window.on('unmaximize', capture);
    window.on('close', capture);
    window.once('closed', () => {
        window.removeListener('moved', capture);
        window.removeListener('resized', capture);
        window.removeListener('maximize', capture);
        window.removeListener('unmaximize', capture);
        window.removeListener('close', capture);
    });
}
