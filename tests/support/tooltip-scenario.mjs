import { expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { canonical } from '../../scripts/lib/visualizer-resource-v2.mjs';

export const tooltipText = label => `属性说明：${label}\n<b>这是纯文本</b>，不会作为 HTML 执行。`;
export function tooltipProject(source) {
    const p = structuredClone(source),
        refs = new Map();
    for (const element of p.resources.elements) {
        const old = element.hash;
        for (const [index, parameter] of element.parameters.entries()) {
            parameter.tooltip =
                index === 0
                    ? tooltipText(parameter.label) + '\n' + '较长说明用于检查自动换行与滚动。'.repeat(90)
                    : tooltipText(parameter.label);
        }
        for (const key of ['markerInputs', 'mediaInputs', 'lyricInputs'])
            for (const input of element[key] ?? []) input.tooltip = tooltipText(input.label);
        element.version += 1000;
        delete element.hash;
        element.hash = createHash('sha256').update(canonical(element)).digest('hex');
        refs.set(old, { id: element.id, version: element.version, hash: element.hash });
    }
    for (const element of p.elements) element.resource = refs.get(element.resource.hash);
    for (const definition of p.resources.presets) {
        const old = definition.hash;
        for (const template of definition.elements) template.element = refs.get(template.element.hash);
        for (const control of definition.controls) control.tooltip = tooltipText(control.label);
        definition.version += 1000;
        delete definition.hash;
        definition.hash = createHash('sha256').update(canonical(definition)).digest('hex');
        refs.set(old, { id: definition.id, version: definition.version, hash: definition.hash });
    }
    for (const item of p.items)
        if (item.kind === 'preset') {
            item.resource = refs.get(item.resource.hash);
            for (const control of item.controls) control.tooltip = tooltipText(control.label);
        }
    return p;
}

export async function runTooltipScenario(page, io) {
    const p = tooltipProject(await io.readProject());
    await io.importProject(p);
    const tip = page.locator('.app-help-tooltip[role=tooltip]:visible');
    const screenshot = async name => {
        await expect(tip).toHaveCSS('opacity', '1');
        await io.screenshot(name);
    };
    const help = page.getByRole('button', { name: '音画同步补偿说明', exact: true });
    await help.hover();
    await expect(tip).toContainText('推荐调整范围是0-120ms');
    const describedBy = await help.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await help.press('Escape');
    await expect(tip).toHaveCount(0);
    await help.focus();
    // Escape keeps focus on the trigger; leave and re-enter focus to reopen.
    await help.press('Tab');
    await help.focus();
    await expect(tip).toHaveCount(1);
    await help.press('Escape');
    await expect(help).toBeFocused();
    const before = await io.readProject();
    await help.click();
    await help.click();
    expect(await io.readProject()).toEqual(before);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    expect(await io.readProject()).toEqual(before);

    const fields = [];
    for (const id of ['point-line-horizontal', 'fade', 'circular-background', 'black-hole-lyrics']) {
        const element = p.elements.find(e => e.resource.id === id);
        await page.locator(`[data-composition-id="${element.id}"] .viz-element-select`).click();
        const definition = p.resources.elements.find(e => e.id === id);
        const input = [
            ...(definition.markerInputs ?? []),
            ...(definition.mediaInputs ?? []),
            ...(definition.lyricInputs ?? []),
        ][0];
        const button = page.getByRole('button', { name: input.label + '说明', exact: true });
        await button.focus();
        await expect(tip).toHaveCount(1);
        await expect(tip).toContainText(tooltipText(input.label));
        expect(await tip.locator('b').count()).toBe(0);
        await button.press('Escape');
        fields.push(id);
    }
    const group = p.items.find(i => i.kind === 'preset');
    await page.locator(`[data-composition-id="${group.id}"] .viz-element-select`).click();
    const control = group.controls[0];
    await page.getByRole('button', { name: control.label + '说明', exact: true }).focus();
    await expect(tip).toContainText(tooltipText(control.label));
    await page.keyboard.press('Escape');

    const solid = p.elements.find(e => e.resource.id === 'solid');
    await page.getByRole('button', { name: '展开' + group.name, exact: true }).click();
    await page.locator(`[data-composition-id="${solid.id}"] .viz-element-select`).click();
    const parameter = p.resources.elements.find(e => e.id === 'solid').parameters[0];
    const button = page.getByRole('button', { name: parameter.label + '说明', exact: true });
    await button.focus();
    await expect(tip).toContainText(tooltipText(parameter.label));
    await tip.hover();
    await expect(tip).toHaveCount(1);
    expect(await tip.locator('.app-help-content').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await screenshot('long-text');
    await page.keyboard.press('Escape');
    const other = p.resources.elements.find(e => e.id === 'solid').parameters[1];
    const value = page.getByRole('spinbutton', { name: other.label, exact: true });
    await page.locator(`[data-parameter-id="${other.id}"] label`).click();
    await expect(value).toBeFocused();
    await button.hover();
    await expect(tip).toContainText(tooltipText(parameter.label));
    await page.getByRole('button', { name: other.label + '说明', exact: true }).hover();
    await expect(tip).toHaveCount(1);
    await expect(tip).toContainText(tooltipText(other.label));
    await page.keyboard.press('Escape');

    const bounds = async () => {
        const rect = await tip.boundingBox();
        const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
        expect(rect.x).toBeGreaterThanOrEqual(7);
        expect(rect.y).toBeGreaterThanOrEqual(7);
        expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width - 7);
        expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height - 7);
        const anchor = await button.boundingBox();
        expect(
            rect.x + rect.width <= anchor.x ||
                anchor.x + anchor.width <= rect.x ||
                rect.y + rect.height <= anchor.y ||
                anchor.y + anchor.height <= rect.y,
        ).toBe(true);
        return rect;
    };
    for (const width of [1024, 390, 1920]) {
        await io.resizeViewport(width, 800);
        if (!(await button.isVisible())) await page.getByRole('button', { name: '元素属性', exact: true }).click();
        await button.scrollIntoViewIfNeeded();
        await button.blur();
        await button.focus();
        await expect(tip).toBeVisible();
        await expect
            .poll(async () => {
                try {
                    await bounds();
                    return true;
                } catch {
                    return false;
                }
            })
            .toBe(true);
        await screenshot('width-' + width);
        await page.keyboard.press('Escape');
    }
    // Reposition the real component's anchor to exercise all four viewport edges.
    const placements = [];
    for (const corner of ['left-top', 'right-top', 'left-bottom', 'right-bottom']) {
        await button.evaluate((el, corner) => {
            el.style.cssText = `position:fixed;z-index:5000;${corner.includes('left') ? 'left' : 'right'}:8px;${corner.includes('top') ? 'top' : 'bottom'}:8px`;
        }, corner);
        await button.press('Tab');
        await button.focus();
        await expect(tip).toBeVisible();
        await expect
            .poll(async () => {
                try {
                    await bounds();
                    return true;
                } catch {
                    return false;
                }
            })
            .toBe(true);
        placements.push(await tip.getAttribute('data-popper-placement'));
        await page.keyboard.press('Escape');
    }
    await button.evaluate(el => el.removeAttribute('style'));
    // Reuse the mounted component in native top-layer containers, then restore its DOM owner.
    for (const mode of ['dialog', 'fullscreen']) {
        await button.evaluate((el, mode) => {
            const field = el.closest('.viz-field');
            const marker = document.createComment('tooltip test restore point');
            field.before(marker);
            const host = document.createElement(mode === 'dialog' ? 'dialog' : 'div');
            host.id = 'tooltip-top-layer-fixture';
            host.style.cssText =
                'position:fixed;inset:80px;z-index:6000;padding:40px;background:#0b1710;color:#effff6;min-width:400px';
            const open = document.createElement('button');
            open.textContent = '测试全屏容器';
            open.onclick = () => host.requestFullscreen();
            host.append(open, field);
            document.body.append(host);
            window.__tooltipRestore = () => {
                marker.replaceWith(field);
                host.remove();
            };
            if (mode === 'dialog') host.showModal();
        }, mode);
        if (mode === 'fullscreen') await page.getByRole('button', { name: '测试全屏容器', exact: true }).click();
        await button.blur();
        await button.focus();
        await expect(tip).toBeVisible();
        expect(await tip.evaluate(el => el.parentElement?.id)).toBe('tooltip-top-layer-fixture');
        expect(
            await tip.evaluate(el => {
                const r = el.getBoundingClientRect();
                return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
            }),
        ).toBe(true);
        await screenshot(mode);
        await page.keyboard.press('Escape');
        if (mode === 'dialog') await page.locator('#tooltip-top-layer-fixture').evaluate(el => el.close());
        else await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : undefined));
        await page.evaluate(() => {
            window.__tooltipRestore();
            delete window.__tooltipRestore;
        });
    }
    // Constrain the real scrolling panel so the anchor can leave its clipping boundary.
    await page.locator('.viz-inspector-fields').evaluate(el => {
        el.style.maxHeight = '120px';
    });
    await button.blur();
    await button.focus();
    await expect(tip).toBeVisible();
    await page.locator('.viz-inspector-fields').evaluate(el => {
        el.scrollTop = 0;
    });
    await expect(tip).toHaveCount(0);
    await page.locator('.viz-inspector-fields').evaluate(el => el.removeAttribute('style'));
    await io.resizeViewport(1920, 1080);
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    await expect(tip).toHaveCount(0);
    return {
        fields,
        placements,
        persisted: (await io.lastProject()).resources.elements.every(e =>
            e.parameters.every(p => typeof p.tooltip === 'string'),
        ),
    };
}
