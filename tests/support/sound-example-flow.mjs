import { expect } from '@playwright/test';

export async function storedExampleProfiles(page) {
    return page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('editor-sound-examples', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        try {
            return await new Promise((resolve, reject) => {
                const request = db.transaction('profiles').objectStore('profiles').getAll();
                request.onsuccess = () => resolve(request.result.map(row => row.profile));
                request.onerror = () => reject(request.error);
            });
        } finally {
            db.close();
        }
    });
}

/** Existing six-second FT fixture, actual source readers, no new separation. */
export async function exerciseStoredSoundExamples(page, eventCount) {
    const panel = page.getByTestId('editor-sound-examples'),
        source = panel.getByLabel('示例检索来源');
    await expect(source.locator('option')).toHaveCount(7);
    const originalKey = await source.locator('option').first().getAttribute('value');
    const results = [];
    for (const [label, audition] of [
        ['原曲', 'original'],
        ['FT other', 'ft'],
        ['已有辅助钢琴', 'auxiliary'],
    ]) {
        await source.selectOption({ label });
        await panel.getByLabel('声音示例类型').selectOption('range');
        await panel.getByLabel('声音示例起点').fill('0.5');
        await panel.getByLabel('声音示例终点').fill('1.8');
        await panel.getByTestId('sound-example-add').click();
        await panel.getByTestId('sound-example-search').click();
        await expect(panel).toHaveAttribute('data-state', 'ready', { timeout: 60000 });
        await expect(panel.getByTestId('sound-example-match').first()).toBeVisible();
        const key = await source.inputValue();
        await expect
            .poll(async () => (await storedExampleProfiles(page)).find(p => p.sourceKey === key)?.matches.length)
            .toBeGreaterThan(0);
        const profile = (await storedExampleProfiles(page)).find(p => p.sourceKey === key);
        expect(profile.matches.every(m => !m.selected)).toBe(true);
        await panel
            .getByTestId('sound-example-match')
            .first()
            .getByRole('button', { name: '试听', exact: true })
            .click();
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-audition-source', audition);
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
        await page.getByTestId('toggle-playback').click();
        results.push({ label, profileId: profile.id, sourceKey: key, matches: profile.matches.length });
    }
    await source.selectOption(originalKey);
    await panel.getByTestId('sound-example-match').first().getByLabel('勾选检索候选').check();
    const before = await eventCount();
    await panel.getByTestId('sound-example-apply').click();
    await expect.poll(eventCount).toBe(before + 1);
    await panel.getByTestId('sound-example-apply').click();
    expect(await eventCount()).toBe(before + 1);
    await expect(panel).toContainText('示例已保存到本机');
    return { sources: results, applied: 1 };
}
