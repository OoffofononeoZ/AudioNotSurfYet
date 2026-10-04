import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { test } from '../processing/persistentFixture';
import type { P1Api } from '../processing/harness';
type HarnessWindow={__P1:P1Api};
test('P1 authorized local listening cases produce twelve verified reviewable WAVs',async({page},info)=>{
    test.setTimeout(2_400_000);
    const directory=path.resolve('artifacts/evals/p1-listening');fs.mkdirSync(directory,{recursive:true});
    const cases=JSON.parse(fs.readFileSync('artifacts/fixtures/p1-listening/inputs.json','utf8')) as Array<{id:string;source:string;authorization:string}>;
    expect(cases).toHaveLength(3);
    await page.goto('/tests/processing/index.html');await page.waitForFunction(()=>!!(window as unknown as HarnessWindow).__P1);
    for(const item of cases){
        await page.locator('#audio').setInputFiles(item.source);
        await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.local());
        const report=await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.inspect());
        // Private raw evidence stays ignored; do not copy source paths/hashes to Git.
        fs.writeFileSync(path.join(directory,`${item.id}-technical.json`),JSON.stringify(report,null,2));
        for(const role of ['drums','bass','other','vocals']){
            const downloadPromise=page.waitForEvent('download');await page.locator(`[data-role=${role}]`).click();
            const download=await downloadPromise;await download.saveAs(path.join(directory,`${item.id}-${role}.wav`));
        }
        await info.attach(item.id,{body:JSON.stringify({caseId:item.id,authorization:item.authorization,frames:report.artifacts[0]!.frames,technicalArtifacts:report.artifacts,metrics:report.metrics,ownerListening:'pending'}),contentType:'application/json'});
        expect(report.artifacts.every(a=>a.samplesIdentical&&a.summariesIdentical)).toBe(true);
        console.log(JSON.stringify({caseId:item.id,frames:report.artifacts[0]!.frames,metrics:report.metrics}));
        await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.clear());
    }
    await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.dispose());
});
