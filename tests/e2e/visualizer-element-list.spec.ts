import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

test.use({ viewport: { width: 1920, height: 1080 } });
async function open(page: Page) {
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    if ((await page.getByTestId('toggle-playback').getAttribute('aria-label')) === '暂停')
        await page.getByTestId('toggle-playback').click();
}
async function add(page: Page, preset = false) {
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: preset ? '预设' : '元素', exact: true }).click();
    await page.locator(preset ? '[data-preset-id="geometric-0.6"]' : '[data-element-type="solid"]').click();
}
async function boundaries(page: Page) {
    const geometry = await page.locator('.viz-element-items').evaluate(list => {
        const rows = [...list.querySelectorAll<HTMLElement>('.viz-element-row')];
        const children = list.querySelector<HTMLElement>('.viz-preset-children');
        const style = getComputedStyle(list);
        return {
            padding: [style.paddingTop, style.paddingBottom],
            firstGap: rows.length
                ? rows[0]!.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
                : 0,
            gaps: rows
                .slice(1)
                .map((row, index) => row.getBoundingClientRect().top - rows[index]!.getBoundingClientRect().bottom),
            borders: rows.map(row => getComputedStyle(row).borderBottomWidth),
            children: children
                ? {
                      margin: getComputedStyle(children).margin,
                      padding: getComputedStyle(children).padding,
                      finalGap:
                          children.getBoundingClientRect().bottom -
                          children.lastElementChild!.getBoundingClientRect().bottom,
                  }
                : null,
            overflowX: list.scrollWidth - list.clientWidth,
        };
    });
    expect(geometry.padding).toEqual(['0px', '0px']);
    expect(geometry.firstGap).toBe(0);
    expect(geometry.gaps.every(gap => Math.abs(gap) < 1)).toBe(true);
    expect(geometry.borders.every(border => border === '1px')).toBe(true);
    expect(geometry.overflowX).toBe(0);
    if (geometry.children) expect(geometry.children).toEqual({ margin: '0px', padding: '0px', finalGap: 0 });
}

test('list and expanded presets have continuous boundaries without leading or trailing gaps', async ({
    page,
}, info) => {
    await open(page);
    await expect(page.getByText('尚未添加元素', { exact: true })).toBeVisible();
    await boundaries(page);
    await add(page);
    await boundaries(page);
    await add(page, true);
    await boundaries(page);
    const group = page.locator('.viz-root-item').first();
    await group.getByRole('button', { name: '展开几何律动', exact: true }).click();
    await boundaries(page);
    await page
        .locator('.viz-element-items')
        .screenshot({ path: `artifacts/visualizer-composition/element-list/boundaries-${info.project.name}.png` });
    await group
        .locator('.viz-preset-children .viz-element-row')
        .last()
        .getByRole('button', { name: '删除元素', exact: true })
        .click();
    await boundaries(page);
    await group.getByRole('button', { name: '折叠几何律动', exact: true }).click();
    await boundaries(page);
    await group.getByRole('button', { name: '展开几何律动', exact: true }).click();
    while (await group.locator('.viz-preset-children .viz-element-row').count())
        await group
            .locator('.viz-preset-children .viz-element-row')
            .last()
            .getByRole('button', { name: '删除元素', exact: true })
            .click();
    await expect(page.locator('.viz-root-item')).toHaveCount(1);
    await expect(page.locator('.viz-preset-children')).toHaveCount(0);
    await boundaries(page);
    await page.getByRole('button', { name: '删除元素', exact: true }).click();
    await expect(page.getByText('尚未添加元素', { exact: true })).toBeVisible();
    await boundaries(page);
});
