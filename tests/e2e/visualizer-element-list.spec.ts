import { expect, test, type Page, type Locator } from '@playwright/test';
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

async function rootIds(page: Page) {
    return page.locator('.viz-root-item').evaluateAll(rows => rows.map(row => row.getAttribute('data-root-item-id')));
}
async function childIds(group: Locator) {
    return group.locator('.nested').evaluateAll(rows => rows.map(row => row.getAttribute('data-element-id')));
}
async function rowGeometry(row: Locator) {
    const result = await row.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const buttons = [...element.querySelectorAll<HTMLButtonElement>('.viz-row-actions button')].map(button => {
            const r = button.getBoundingClientRect();
            return {
                label: button.getAttribute('aria-label')!,
                x: r.x - rect.x,
                y: r.y - rect.y,
                width: r.width,
                height: r.height,
                right: r.right - rect.x,
            };
        });
        return {
            height: rect.height,
            width: rect.width,
            buttons,
            nestedButtons: element.querySelectorAll('button button').length,
        };
    });
    expect(result.height).toBe(64);
    expect(result.nestedButtons).toBe(0);
    for (const button of result.buttons) {
        expect(button.width).toBe(24);
        expect(button.height).toBe(24);
        expect(button.right).toBeLessThanOrEqual(result.width - 7);
        expect(button.y).toBeGreaterThanOrEqual(0);
        expect(button.y + button.height).toBeLessThan(result.height);
    }
    const up = result.buttons.find(button => button.label.startsWith('上移'))!;
    const down = result.buttons.find(button => button.label.startsWith('下移'))!;
    const visibility = result.buttons.find(button => /^(隐藏|显示)/.test(button.label))!;
    const remove = result.buttons.find(button => button.label.startsWith('删除'))!;
    expect(up.x).toBe(down.x);
    expect(up.y).toBeLessThan(down.y);
    expect(visibility.x).toBe(remove.x);
    expect(visibility.x).toBeLessThan(up.x);
}

test('whole-row selection, preset actions and compact button geometry work on desktop and in drawers', async ({
    page,
}, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page);
    await add(page);
    await add(page);
    await add(page, true);
    const ids = await rootIds(page);
    const group = page.locator(`[data-root-item-id="${ids[0]}"]`);
    const header = group.locator(':scope > .viz-element-row');
    const other = page.locator(`.viz-element-row[data-element-id="${ids[2]}"]`);
    for (const point of [
        { x: 4, y: 2 },
        { x: 4, y: 60 },
        { x: (await header.boundingBox())!.width - 3, y: 32 },
    ]) {
        await other.locator('.viz-element-select').click();
        await header.click({ position: point });
        await expect(header).toHaveClass(/selected/);
        await expect(header.getByRole('button', { name: '展开几何律动', exact: true })).toHaveAttribute(
            'aria-expanded',
            'false',
        );
    }
    await other.locator('.viz-element-select').click();
    await header.getByRole('button', { name: '展开几何律动', exact: true }).click();
    await expect(other).toHaveClass(/selected/);
    const childId = (await childIds(group))[1]!;
    const child = page.locator(`.viz-element-row[data-element-id="${childId}"]`);
    await child.click({ position: { x: 4, y: 60 } });
    await expect(child).toHaveClass(/selected/);
    await expect(header).not.toHaveClass(/selected/);
    await header.getByRole('button', { name: '隐藏预设', exact: true }).click();
    await expect(child).toHaveClass(/selected/);
    await header.getByRole('button', { name: '显示预设', exact: true }).click();
    await header.getByRole('button', { name: '下移预设', exact: true }).click();
    await expect(page.locator('.viz-root-item').nth(1)).toHaveAttribute('data-root-item-id', ids[0]!);
    await expect(child).toHaveClass(/selected/);
    await header.getByRole('button', { name: '上移预设', exact: true }).click();
    await expect(child).toHaveClass(/selected/);
    await rowGeometry(header);
    await rowGeometry(child);
    await rowGeometry(other);

    // The 4px gaps between actions remain part of the full-row selection target.
    const actions = await header.locator('.viz-row-actions').boundingBox();
    await page.mouse.click(actions!.x + 26, actions!.y + 26);
    await expect(header).toHaveClass(/selected/);
    const expand = header.getByRole('button', { name: '折叠几何律动', exact: true });
    await header.locator('.viz-element-select').focus();
    await page.keyboard.press('Tab');
    await expect(expand).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(header.getByRole('button', { name: '隐藏预设', exact: true })).toBeFocused();
    await child.locator('.viz-element-select').focus();
    const player = page.locator('#music-bar-container');
    const beforeSpace = await player.getAttribute('data-playback-state');
    await page.keyboard.press('Space');
    await expect(header).toHaveClass(/selected/);
    await expect(player).toHaveAttribute('data-playback-state', beforeSpace === 'playing' ? 'paused' : 'playing');
    await page.keyboard.press('Enter');
    await expect(child).toHaveClass(/selected/);
    await header.locator('.viz-element-select').focus();
    await page.keyboard.press('Enter');
    await expect(header).toHaveClass(/selected/);
    await expect(expand).toHaveAttribute('aria-expanded', 'true');
    await child.locator('.viz-element-select').click();
    const name = page.getByRole('textbox', { name: '元素名称', exact: true });
    const longName = '一个很长的预设子元素名称，用于确认名称省略且操作按钮不会挤压';
    await name.fill(longName);
    await name.press('Tab');
    await expect(child.locator('.viz-row-name')).toHaveAttribute('title', longName);
    expect(await child.locator('.viz-row-name').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(
        true,
    );
    await rowGeometry(child);
    await page
        .locator('.viz-elements')
        .screenshot({ path: `artifacts/visualizer-composition/element-list/desktop-${info.project.name}.png` });
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.getByRole('button', { name: '元素列表', exact: true }).click();
    await child.scrollIntoViewIfNeeded();
    await rowGeometry(child);
    await page
        .locator('.viz-elements')
        .screenshot({ path: `artifacts/visualizer-composition/element-list/drawer-${info.project.name}.png` });
    await child.click({ position: { x: 4, y: 2 } });
    await expect(page.locator('.viz-properties')).toBeVisible();
    await expect(page.locator('.viz-inspector-fields')).toHaveAttribute('data-element-id', childId);
    expect(errors).toEqual([]);
});

test('native drags keep selection, reject action origins and cannot move children between presets', async ({
    page,
}) => {
    await open(page);
    for (let i = 0; i < 3; i++) await add(page);
    const before = await rootIds(page);
    const row = (id: string | null) => page.locator(`.viz-element-row[data-element-id="${id}"]`);
    const source = row(before[2]!);
    const target = row(before[0]!);
    await source.locator('.viz-element-select').dragTo(target.locator('.viz-element-select'), {
        sourcePosition: { x: 60, y: 32 },
        targetPosition: { x: 60, y: 16 },
    });
    expect(await rootIds(page)).toEqual([before[2], before[0], before[1]]);
    await expect(target).toHaveClass(/selected/);
    await source.locator('.viz-element-select').dispatchEvent('click', { detail: 1 });
    await expect(target).toHaveClass(/selected/);
    await source.locator('.viz-element-select').click();
    await expect(source).toHaveClass(/selected/);
    const afterMove = await rootIds(page);
    const action = source.getByRole('button', { name: '隐藏元素', exact: true });
    await action.dragTo(target.locator('.viz-element-select'), { targetPosition: { x: 60, y: 16 } });
    expect(await rootIds(page)).toEqual(afterMove);
    await expect(source).toHaveClass(/selected/);

    await add(page, true);
    await add(page, true);
    const groups = page.locator('.viz-root-item').filter({ has: page.locator('[data-preset-instance-id]') });
    const groupIds = await groups.evaluateAll(elements =>
        elements.map(element => element.getAttribute('data-root-item-id')),
    );
    const first = page.locator(`[data-root-item-id="${groupIds[0]}"]`);
    const second = page.locator(`[data-root-item-id="${groupIds[1]}"]`);
    await first.getByRole('button', { name: '展开几何律动', exact: true }).click();
    await second.getByRole('button', { name: '展开几何律动', exact: true }).click();
    const firstIds = await childIds(first),
        secondIds = await childIds(second);
    await row(firstIds.at(-1)!)
        .locator('.viz-element-select')
        .dragTo(row(firstIds[0]!).locator('.viz-element-select'), {
            sourcePosition: { x: 60, y: 32 },
            targetPosition: { x: 60, y: 16 },
        });
    const reordered = [firstIds.at(-1)!, ...firstIds.slice(0, -1)];
    expect(await childIds(first)).toEqual(reordered);
    await expect(first.locator(':scope > .viz-element-row')).toHaveClass(/selected/);
    await row(reordered[0]!)
        .locator('.viz-element-select')
        .dragTo(row(secondIds[0]!).locator('.viz-element-select'), {
            sourcePosition: { x: 60, y: 32 },
            targetPosition: { x: 60, y: 16 },
        });
    expect(await childIds(first)).toEqual(reordered);
    expect(await childIds(second)).toEqual(secondIds);
    await expect(first.locator(':scope > .viz-element-row')).toHaveClass(/selected/);
});
