import { expect, test, type Page } from '@playwright/test';
import { addMarkerLane, prepareMarkerEditor } from '../support/editor-marking';
import type { PointLaneV1 } from '../../src/editor/types';
import { readEditorDraft as draft } from '../support/editor-draft';
async function compensate(page: Page, cells: string) {
    await page.getByTestId('marker-compensation').click();
    await page.getByRole('spinbutton', { name: '提前格数', exact: true }).fill(cells);
    await page.getByRole('spinbutton', { name: '提前格数', exact: true }).press('Tab');
    await page.getByTestId('apply-marker-compensation').click();
}
const cursor = async (page: Page) =>
    Number(await page.getByTestId('marker-ruler-time').getAttribute('data-cursor-seconds'));
test('recording compensation applies to real playback, cancels pending ranges and is page-local', async ({ page }) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await addMarkerLane(page, 'range');
    await compensate(page, '3');
    await expect(page.getByTestId('marker-compensation')).toContainText('3 格');
    await page.getByTestId('toggle-playback').click();
    await expect.poll(() => cursor(page)).toBeGreaterThan(1);
    const before = await cursor(page);
    await page.keyboard.press('1');
    await expect.poll(async () => (await draft(page)).lanes[0]!.events.length).toBe(1);
    const event = ((await draft(page)).lanes[0] as PointLaneV1).events[0]!;
    expect(before - event.atSeconds).toBeGreaterThan(0.2);
    expect(before - event.atSeconds).toBeLessThan(0.55);
    await page.keyboard.down('2');
    await expect(page.getByTestId('keyboard-recording-status')).toBeVisible();
    await page.getByTestId('marker-compensation').click();
    await expect(page.getByTestId('keyboard-recording-status')).not.toBeVisible();
    await page.getByRole('spinbutton', { name: '提前格数', exact: true }).fill('4');
    await page.getByTestId('apply-marker-compensation').click();
    await page.keyboard.up('2');
    await page.getByTestId('toggle-playback').click();
    expect((await draft(page)).lanes[1]!.events).toEqual([]);
    await page.getByTestId('editor-separation-tab').click();
    await page.getByTestId('editor-marking-tab').click();
    await expect(page.getByTestId('marker-compensation')).toContainText('4 格');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'artifacts/editor-marking/compensation-narrow.png' });
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('marker-compensation').click();
    await expect(page.getByRole('spinbutton', { name: '提前格数', exact: true })).toHaveValue('0');
});
test('large early compensation rejects underflow and numeric input does not record markers', async ({ page }) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await compensate(page, '64');
    await page.getByTestId('toggle-playback').click();
    await page.keyboard.press('1');
    await expect(page.getByTestId('point-workspace-status')).toContainText('歌曲范围');
    await page.getByTestId('marker-compensation').click();
    await page.getByRole('spinbutton', { name: '提前格数', exact: true }).fill('1.7');
    await page.getByRole('spinbutton', { name: '提前格数', exact: true }).press('Tab');
    await expect(page.getByRole('spinbutton', { name: '提前格数', exact: true })).toHaveValue('2');
    await expect.poll(async () => (await draft(page)).lanes[0]!.events.length).toBe(0);
    await page
        .getByRole('dialog', { name: '标记补偿', exact: true })
        .getByRole('button', { name: '取消', exact: true })
        .click();
});
