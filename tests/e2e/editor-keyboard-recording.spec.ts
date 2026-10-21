import { expect, test, type Page } from '@playwright/test';
import { addMarkerLane, prepareMarkerEditor, seekMarkerEditor } from '../support/editor-marking';
import type { EditorProjectV2, PointEventV1, RangeEventV1 } from '../../src/editor/types';
import { queuePickerData } from '../support/file-picker';

async function draft(page: Page): Promise<EditorProjectV2> {
    return page.evaluate(
        () =>
            new Promise((resolve, reject) => {
                const request = indexedDB.open('audionotsurfyet-editor');
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result;
                    const get = db.transaction('draft').objectStore('draft').get('latest');
                    get.onerror = () => {
                        db.close();
                        reject(get.error);
                    };
                    get.onsuccess = () => {
                        db.close();
                        resolve(get.result?.envelope.project);
                    };
                };
            }),
    );
}
const events = async (page: Page) =>
    (await draft(page)).lanes.flatMap<PointEventV1 | RangeEventV1>(lane => lane.events);
const cursor = async (page: Page) =>
    Number(await page.getByTestId('marker-ruler-time').getAttribute('data-cursor-seconds'));
const waitAfter = async (page: Page, seconds: number) => expect.poll(() => cursor(page)).toBeGreaterThan(seconds);
async function play(page: Page) {
    await page.getByTestId('toggle-playback').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
}
async function pause(page: Page) {
    await page.getByTestId('toggle-playback').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
}
async function savedCount(page: Page, count: number) {
    await expect.poll(async () => (await events(page)).length).toBe(count);
}

test('classification numbers, collapsed rows, repeat protection, concurrent holds and persisted clock snapping', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await page.locator('[data-testid^="add-inner-class-"]').click();
    await addMarkerLane(page, 'range');
    await page.locator('[data-testid^="add-range-inner-class-"]').click();
    await expect(page.locator('.marker-shortcut')).toHaveText(['1', '2', '3', '4']);
    await page
        .getByRole('button', { name: /折叠轨道/ })
        .first()
        .click();
    await play(page);
    await waitAfter(page, 0.3);
    await page.keyboard.down('1');
    await page.keyboard.down('1');
    await page.keyboard.press('2');
    await savedCount(page, 2);
    await page.keyboard.up('1');
    await page.keyboard.down('3');
    await page.keyboard.down('4');
    await expect(page.getByTestId('keyboard-recording-status')).toContainText('3、4');
    await expect(page.getByTestId('keyboard-range-preview')).toHaveCount(2);
    const start = await cursor(page);
    await waitAfter(page, start + 0.4);
    await pause(page);
    await page.keyboard.up('3');
    await page.keyboard.up('4');
    await savedCount(page, 4);
    const project = await draft(page);
    expect(project.lanes[0]!.events.map(event => event.innerClassId).sort()).toEqual(
        project.lanes[0]!.innerClasses.map(row => row.id).sort(),
    );
    expect(project.lanes[1]!.events).toHaveLength(2);
    for (const event of project.lanes.flatMap<PointEventV1 | RangeEventV1>(lane => lane.events)) {
        for (const time of 'atSeconds' in event ? [event.atSeconds] : [event.startSeconds, event.endSeconds])
            expect(time * 8).toBeCloseTo(Math.round(time * 8), 5);
    }
    await page
        .getByRole('button', { name: /展开轨道/ })
        .first()
        .click();
    await page.screenshot({ path: 'artifacts/editor-marking/keyboard-recording-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'artifacts/editor-marking/keyboard-recording-narrow.png' });
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await savedCount(page, 4);
    expect(errors).toEqual([]);
});

test('keyup commits once, short presses extend and numeric keypad uses the same category', async ({ page }) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'range');
    await play(page);
    await page.keyboard.press('1');
    await savedCount(page, 1);
    let value = (await events(page))[0]!;
    expect('endSeconds' in value && value.endSeconds - value.startSeconds).toBeCloseTo(0.125, 5);
    const time = await cursor(page);
    await waitAfter(page, time + 0.4);
    // NumLock-on key semantics, independent of the machine's physical lock state.
    await page.evaluate(() =>
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: '1', code: 'Numpad1', bubbles: true, cancelable: true }),
        ),
    );
    await expect(page.getByTestId('keyboard-recording-status')).toBeVisible();
    const begin = await cursor(page);
    await waitAfter(page, begin + 0.35);
    await page.evaluate(() =>
        window.dispatchEvent(
            new KeyboardEvent('keyup', { key: '1', code: 'Numpad1', bubbles: true, cancelable: true }),
        ),
    );
    await savedCount(page, 2);
    value = (await events(page))[1]!;
    expect('endSeconds' in value && value.endSeconds > value.startSeconds).toBe(true);
    await pause(page);
    await savedCount(page, 2);
});

test('seek, Escape, blur, grid changes and workspace changes cancel; inputs and modifiers retain their keys', async ({
    page,
}) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'range');
    await play(page);
    for (const action of [
        'seek',
        'speed',
        'escape',
        'blur',
        'hidden',
        'focus',
        'dialog',
        'grid',
        'import',
        'workspace',
    ]) {
        await page.keyboard.down('1');
        await expect(page.getByTestId('keyboard-recording-status')).toBeVisible();
        if (action === 'seek') {
            await page.getByTestId('editor-timeline').focus();
            await page.keyboard.press('Home');
            await page.keyboard.press('ArrowRight');
        }
        if (action === 'speed') {
            await page.getByTestId('playback-speed').click();
            await page.locator('.speed-panel input').evaluate(element => {
                const slider = element as HTMLInputElement;
                slider.value = '0.5';
                slider.dispatchEvent(new Event('input', { bubbles: true }));
            });
            await page.keyboard.press('Escape');
        }
        if (action === 'escape') await page.keyboard.press('Escape');
        if (action === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        if (action === 'hidden')
            await page.evaluate(() => {
                Object.defineProperty(document, 'hidden', { configurable: true, value: true });
                document.dispatchEvent(new Event('visibilitychange'));
                Reflect.deleteProperty(document, 'hidden');
            });
        if (action === 'focus')
            await page.evaluate(() => {
                const input = document.createElement('input');
                document.body.append(input);
                input.focus();
                input.remove();
            });
        if (action === 'dialog')
            await page.evaluate(() => {
                const dialog = document.createElement('dialog');
                dialog.id = 'recording-dialog-probe';
                document.body.append(dialog);
                dialog.showModal();
            });
        if (action === 'grid') await page.getByRole('button', { name: '增大节拍细分', exact: true }).click();
        if (action === 'import') {
            await queuePickerData(page, [
                { name: 'same-project.json', mimeType: 'application/json', text: JSON.stringify(await draft(page)) },
            ]);
            await page.getByTestId('import-editor-project').click();
            await page.mouse.move(0, 500);
            await expect(page.getByRole('alert')).toHaveCount(0);
        }
        if (action === 'workspace') {
            await page.getByTestId('editor-separation-tab').click();
            await page.getByTestId('editor-marking-tab').click();
        }
        await expect(page.getByTestId('keyboard-recording-status')).toHaveCount(0);
        await page.keyboard.up('1');
        if (action === 'dialog') {
            await page.keyboard.press('1');
            await page.evaluate(() => document.getElementById('recording-dialog-probe')?.remove());
        }
    }
    await page.keyboard.press('Shift+1');
    await page.keyboard.press('Alt+1');
    expect(
        await page.evaluate(() =>
            [{ ctrlKey: true }, { metaKey: true }, { isComposing: true }].map(modifier => {
                const event = new KeyboardEvent('keydown', {
                    key: '1',
                    code: 'Digit1',
                    bubbles: true,
                    cancelable: true,
                    ...modifier,
                });
                window.dispatchEvent(event);
                return event.defaultPrevented;
            }),
        ),
    ).toEqual([false, false, false]);
    await page.evaluate(() => {
        const input = document.createElement('input');
        input.id = 'recording-focus-probe';
        document.body.append(input);
        input.focus();
    });
    await page.keyboard.press('1');
    await expect(page.locator('#recording-focus-probe')).toHaveValue('1');
    await page.evaluate(() => document.getElementById('recording-focus-probe')?.remove());
    await pause(page);
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
    expect(await events(page)).toHaveLength(0);
    await page.keyboard.press('1');
    expect(await events(page)).toHaveLength(0);
});

test('leaving cancels held ranges and repeated route entry releases keyboard listeners', async ({ page }) => {
    await page.addInitScript(() => {
        const callbacks = new Set<EventListenerOrEventListenerObject>();
        const add = window.addEventListener.bind(window),
            remove = window.removeEventListener.bind(window);
        window.addEventListener = ((
            type: string,
            callback: EventListenerOrEventListenerObject,
            options?: boolean | AddEventListenerOptions,
        ) => {
            // The shared transport owns a separate capture listener; count only marker recording.
            if (type === 'keyup' && options !== true && !(typeof options === 'object' && options.capture))
                callbacks.add(callback);
            add(type, callback, options);
        }) as typeof window.addEventListener;
        window.removeEventListener = ((
            type: string,
            callback: EventListenerOrEventListenerObject,
            options?: boolean | EventListenerOptions,
        ) => {
            if (type === 'keyup' && options !== true && !(typeof options === 'object' && options.capture))
                callbacks.delete(callback);
            remove(type, callback, options);
        }) as typeof window.removeEventListener;
        Object.defineProperty(window, '__recordingKeyupListeners', { get: () => callbacks.size });
    });
    const count = () => page.evaluate(() => Reflect.get(window, '__recordingKeyupListeners') as number);
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await addMarkerLane(page, 'range');
    for (let iteration = 1; iteration <= 3; iteration++) {
        expect(await count()).toBe(1);
        await seekMarkerEditor(page, iteration);
        await play(page);
        await page.keyboard.press('1');
        await savedCount(page, iteration);
        await page.keyboard.down('2');
        await expect(page.getByTestId('keyboard-recording-status')).toBeVisible();
        await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
        if (await page.getByTestId('editor-leave-dialog').isVisible())
            await page.getByTestId('editor-leave-confirm').click();
        await expect(page).toHaveURL(/analyzer$/);
        await expect.poll(count).toBe(0);
        await page.keyboard.up('2');
        await page.getByTestId('header-editor-link').click();
        await expect(page.getByTestId('editor-ready')).toBeVisible();
        await expect(page.getByTestId('keyboard-recording-status')).toHaveCount(0);
        await savedCount(page, iteration);
        await pause(page);
    }
});

test('natural end finalizes at the song endpoint before repeat; holding through repeat does not start another range', async ({
    page,
}) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'range');
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
    const duration = (await draft(page)).track.durationSeconds;
    await seekMarkerEditor(page, Math.max(0, Math.floor(duration) - 1));
    await play(page);
    await page.keyboard.down('1');
    await expect(page.getByTestId('keyboard-recording-status')).toBeVisible();
    await expect(page.getByTestId('keyboard-recording-status')).toHaveCount(0, { timeout: 5000 });
    await savedCount(page, 1);
    const event = (await events(page))[0]!;
    expect('endSeconds' in event && event.endSeconds).toBeCloseTo(duration, 6);
    await page.keyboard.down('1');
    await expect(page.getByTestId('keyboard-recording-status')).toHaveCount(0);
    await page.keyboard.up('1');
    await pause(page);
    await savedCount(page, 1);
});
