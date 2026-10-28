import { chooseEditorProjectImport } from '../support/project-actions';
import { expect, test, type Page } from '@playwright/test';
import {
    addMarkerLane,
    clickMarkerTime,
    dragMarkerTimes,
    markerSurface,
    prepareMarkerEditor,
    seekMarkerEditor,
} from '../support/editor-marking';
import { readEditorDraft } from '../support/editor-draft';
import { queuePickerData } from '../support/file-picker';
import type { EditorProjectV2, PointLaneV1, RangeLaneV1 } from '../../src/editor/types';

async function importProject(page: Page, project: EditorProjectV2) {
    await queuePickerData(page, [
        { name: 'lane-movement.json', mimeType: 'application/json', text: JSON.stringify(project) },
    ]);
    await chooseEditorProjectImport(page);
    await expect(page.getByTestId('editor-save-state')).toContainText('已保存');
    await expect.poll(async () => (await readEditorDraft(page)).lanes).toEqual(project.lanes);
}
async function seededEditor(page: Page) {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await addMarkerLane(page, 'range');
    await expect(page.getByTestId('editor-save-state')).toContainText('已保存');
    const p = await readEditorDraft(page);
    const points = p.lanes[0] as PointLaneV1,
        ranges = p.lanes[1] as RangeLaneV1;
    points.innerClasses.push({ id: 'second-class', label: '隐藏分类' });
    points.events = [
        { id: 'first-point', innerClassId: points.innerClasses[0]!.id, atSeconds: 2 },
        { id: 'second-point', innerClassId: points.innerClasses[0]!.id, atSeconds: 3 },
        { id: 'hidden-point', innerClassId: 'second-class', atSeconds: 9 },
    ];
    ranges.events = [{ id: 'range', innerClassId: ranges.innerClasses[0]!.id, startSeconds: 2, endSeconds: 3 }];
    await importProject(page, p);
    return p;
}
test('whole-lane movement includes folded, offscreen and all-category events and keeps other lanes and IDs', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const p = await seededEditor(page);
    await seekMarkerEditor(page, 5);
    await page.getByRole('button', { name: `折叠轨道 ${p.lanes[0]!.name}`, exact: true }).click();
    await page.getByTestId('marker-track-operations').click();
    const dialog = page.getByRole('dialog', { name: '轨道操作', exact: true });
    await expect(dialog.getByRole('combobox', { name: '标记轨道' })).toHaveValue(p.lanes[0]!.id);
    await expect(dialog).toContainText('共 3 个标记');
    await expect(dialog.getByRole('spinbutton', { name: '移动格数', exact: true })).toHaveValue('1');
    await page.getByTestId('move-track-forward').click();
    await expect(dialog).toBeHidden();
    await expect
        .poll(async () => (await readEditorDraft(page)).lanes[0]!.events)
        .toEqual((p.lanes[0] as PointLaneV1).events.map(e => ({ ...e, atSeconds: e.atSeconds - 0.125 })));
    expect((await readEditorDraft(page)).lanes[1]).toEqual(p.lanes[1]);
    await page.getByTestId('marker-track-operations').click();
    await page.getByTestId('move-track-backward').click();
    await expect.poll(async () => (await readEditorDraft(page)).lanes).toEqual(p.lanes);
    await page.getByTestId('marker-track-operations').click();
    await dialog.getByRole('combobox', { name: '标记轨道' }).selectOption(p.lanes[1]!.id);
    await dialog.getByRole('spinbutton', { name: '移动格数', exact: true }).fill('2');
    await page.getByTestId('move-track-backward').click();
    await expect
        .poll(async () => (await readEditorDraft(page)).lanes[1]!.events)
        .toEqual([{ ...(p.lanes[1] as RangeLaneV1).events[0]!, startSeconds: 2.25, endSeconds: 3.25 }]);
    expect((await readEditorDraft(page)).lanes[0]).toEqual(p.lanes[0]);
    expect(errors).toEqual([]);
});
test('a failed move keeps the entire project unchanged; dialogs cancel on grid, project or playback changes', async ({
    page,
}) => {
    const p = await seededEditor(page);
    (p.lanes[0] as PointLaneV1).events[0]!.atSeconds = 0;
    await importProject(page, p);
    const before = await readEditorDraft(page);
    await page.getByTestId('marker-track-operations').click();
    const dialog = page.getByRole('dialog', { name: '轨道操作', exact: true });
    await page.getByTestId('move-track-forward').click();
    await expect(dialog.getByRole('alert')).toContainText('歌曲范围');
    expect(await readEditorDraft(page)).toEqual(before);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog).toBeInViewport();
    await page.screenshot({ path: 'artifacts/editor-marking/track-operations-narrow.png' });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.getByTestId('marker-track-operations').click();
    await page.getByRole('button', { name: '增大节拍细分', exact: true }).dispatchEvent('click');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: '减小节拍细分', exact: true }).click();
    // Dispatch the same native control actions while the modal owns pointer input.
    await page.getByTestId('marker-track-operations').click();
    await page.getByTestId('toggle-playback').dispatchEvent('click');
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('marker-track-operations')).toBeDisabled();
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('marker-track-operations').click();
    await page.getByTestId('editor-separation-tab').dispatchEvent('click');
    await expect(dialog).toBeHidden();
    await page.getByTestId('editor-marking-tab').click();
    await page.getByTestId('marker-track-operations').click();
    await page.getByTestId('import-editor-project').dispatchEvent('click');
    await page.getByTestId('import-project-file').click();
    // A cancelled picker does not alter the project or dismiss a valid operation.
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    expect((await readEditorDraft(page)).lanes).toEqual(before.lanes);
    p.lanes[0]!.name = '替换后的轨道';
    await queuePickerData(page, [{ name: 'replacement.json', mimeType: 'application/json', text: JSON.stringify(p) }]);
    await page.getByTestId('marker-track-operations').click();
    await page.getByTestId('import-editor-project').dispatchEvent('click');
    await page.getByTestId('import-project-file').click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await readEditorDraft(page)).lanes[0]!.name).toBe('替换后的轨道');
});
test('opening track operations clears pending mouse ranges and block selections and is disabled for empty tracks', async ({
    page,
}) => {
    await prepareMarkerEditor(page);
    await expect(page.getByTestId('marker-track-operations')).toBeDisabled();
    await addMarkerLane(page, 'point');
    await expect(page.getByTestId('marker-track-operations')).toBeDisabled();
    await addMarkerLane(page, 'range');
    const points = markerSurface(page, 'point'),
        ranges = markerSurface(page, 'range');
    await clickMarkerTime(points, 2);
    await clickMarkerTime(ranges, 1, 'left', 8);
    await expect(page.getByTestId('marker-pending')).toBeVisible();
    await page.getByTestId('marker-track-operations').click();
    await expect(page.getByTestId('marker-pending')).toBeHidden();
    await page.keyboard.press('Escape');
    await page.getByTestId('toggle-block-mode').click();
    await dragMarkerTimes(page, points, 1.8, 2.5);
    await expect(points.locator('.marker-block-selection')).toBeVisible();
    await page.getByTestId('marker-track-operations').click();
    await expect(points.locator('.marker-block-selection')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('toggle-block-mode')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('marker-track-operations')).toBeFocused();
});
