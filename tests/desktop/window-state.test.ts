import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import type { BrowserWindow } from 'electron';
import path from 'node:path';
import { loadWindowState, windowPlacement, trackWindowState, type WindowState } from '../../electron/windowState';

const base = path.resolve('test-results/window-state');
const primary = { x: 0, y: 0, width: 1920, height: 1040 };
let root: string;
beforeEach(async () => {
    await mkdir(base, { recursive: true });
    root = await mkdtemp(path.join(base, 'window-'));
});
afterEach(async () => {
    vi.restoreAllMocks();
    expect(path.dirname(root)).toBe(base);
    expect(path.basename(root)).toMatch(/^window-/);
    await rm(root, { recursive: true, force: true });
});
const state = (bounds = { x: 120, y: 70, width: 1200, height: 800 }): WindowState => ({
    version: 1,
    bounds,
    maximized: true,
});

test('restores normal bounds on a negative-coordinate monitor and clamps removed or smaller displays', () => {
    const left = { x: -1920, y: 0, width: 1920, height: 1040 };
    const saved = state({ ...left, x: -1800, y: 80, width: 1200, height: 800 });
    expect(windowPlacement(saved, primary, [primary, left])).toEqual(saved);
    expect(windowPlacement(saved, primary, [primary]).bounds.x).toBe(0);
    expect(windowPlacement(state({ x: 4000, y: 3000, width: 4000, height: 3000 }), primary, [primary]).bounds).toEqual(
        primary,
    );
    expect(windowPlacement(null, primary, [primary]).bounds).toEqual({ x: 240, y: 40, width: 1440, height: 960 });
});

test('missing or invalid preferences use a default placement without changing other data', async () => {
    const file = path.join(root, 'window-state.json');
    expect(loadWindowState(file)).toBeNull();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const text of [
        '{broken',
        JSON.stringify({ ...state(), version: 2 }),
        JSON.stringify(state({ x: 0, y: 0, width: -1, height: 800 })),
    ]) {
        await writeFile(file, text, 'utf8');
        expect(loadWindowState(file)).toBeNull();
        expect(await readFile(file, 'utf8')).toBe(text);
    }
    expect(warning).toHaveBeenCalledTimes(3);
});

test('persists normal bounds and maximized state, ignores temporary minimized/fullscreen bounds and releases listeners', async () => {
    const events = new EventEmitter();
    let minimized = false,
        fullscreen = false,
        maximized = false;
    const normal = state().bounds;
    const window = Object.assign(events, {
        isDestroyed: () => false,
        isMinimized: () => minimized,
        isFullScreen: () => fullscreen,
        isMaximized: () => maximized,
        getNormalBounds: () => normal,
    }) as unknown as BrowserWindow;
    const file = path.join(root, 'window-state.json');
    trackWindowState(window, file);
    events.emit('moved');
    expect(loadWindowState(file)).toEqual({ ...state(), maximized: false });
    maximized = true;
    events.emit('maximize');
    expect(loadWindowState(file)).toEqual(state());
    maximized = false;
    minimized = true;
    events.emit('close');
    expect(loadWindowState(file)).toEqual(state());
    minimized = false;
    fullscreen = true;
    events.emit('resized');
    expect(loadWindowState(file)).toEqual(state());
    expect(await readdir(root)).toEqual(['window-state.json']);
    events.emit('closed');
    for (const event of ['moved', 'resized', 'maximize', 'unmaximize', 'close'])
        expect(events.listenerCount(event)).toBe(0);
});
