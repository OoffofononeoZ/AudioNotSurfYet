import fs from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';
import { storedExampleProfiles } from './sound-example-flow.mjs';

/** Run only after the performance interval, using the application's existing FT source. */
export async function exerciseRealRangeExamples(page, referenceFile, directory, sourceHash) {
    const manual = JSON.parse(await fs.readFile(referenceFile, 'utf8'));
    expect(manual.track.contentHash).toBe(sourceHash);
    const lane = manual.lanes[2],
        mid = lane.events.filter(e => e.innerClassId === lane.events[0].innerClassId);
    expect(mid).toHaveLength(2);
    const panel = page.getByTestId('editor-sound-examples');
    await panel.getByLabel('示例检索来源').selectOption({ label: 'FT drums' });
    const key = await panel.getByLabel('示例检索来源').inputValue(),
        runId = Date.now(),
        reports = [];
    for (let i = 0; i < 2; i++) {
        // A warm test profile may already contain an earlier reciprocal query.
        // Keep each direction isolated from those stored positive examples.
        await panel.getByRole('button', { name: '新声音组', exact: true }).click();
        const name = `real-ft-mid-${i}-${runId}`,
            example = mid[i],
            target = mid[1 - i];
        await panel.getByLabel('示例声音组名称').fill(name);
        await panel.getByLabel('示例声音组名称').press('Tab');
        await panel.getByLabel('声音示例类型').selectOption('range');
        await panel.getByLabel('声音示例起点').fill(String(example.startSeconds));
        await panel.getByLabel('声音示例终点').fill(String(example.endSeconds));
        await panel.getByTestId('sound-example-add').click();
        await panel.getByTestId('sound-example-search').click();
        await expect.poll(() => panel.getAttribute('data-state'), { timeout: 120000 }).toMatch(/^(ready|error)$/);
        expect(await panel.getAttribute('data-state'), (await panel.textContent()) ?? '').toBe('ready');
        await expect(panel).toContainText('示例已保存到本机');
        const profile = (await storedExampleProfiles(page)).find(p => p.label === name);
        expect(profile.sourceKey).toBe(key);
        expect(profile.threshold).toBe(0.82);
        expect(profile.examples).toHaveLength(1);
        expect(profile.matches.every(match => !match.selected)).toBe(true);
        const nearby = profile.matches.filter(m => Math.abs(m.startSeconds - target.startSeconds) <= 0.1),
            best = [...nearby].sort((a, b) => b.positiveScore - a.positiveScore)[0] ?? null;
        const report = {
            example,
            target,
            best,
            startErrorSeconds: best ? best.startSeconds - target.startSeconds : null,
            endErrorSeconds: best ? best.endSeconds - target.endSeconds : null,
            profile,
            note: 'Fixed threshold; other matches unreviewed. Start correspondence does not prove correct range boundaries.',
        };
        reports.push(report);
        await fs.writeFile(path.join(directory, `real-ft-query-${i}.json`), JSON.stringify(report, null, 2), 'utf8');
        console.log(`FT mid ${i}: ${profile.matches.length} candidates; target ${best?.positiveScore ?? 'missed'}`);
    }
    return reports.map(r => ({
        exampleStart: r.example.startSeconds,
        targetStart: r.target.startSeconds,
        best: r.best,
        startErrorSeconds: r.startErrorSeconds,
        endErrorSeconds: r.endErrorSeconds,
    }));
}
