import { expect } from '@playwright/test';
import { test } from '../processing/persistentFixture';
import type { P1Api } from '../processing/harness';

type HarnessWindow={__P1:P1Api};
test('P1 stage timing diagnostic preserves the complete four-stem artifacts',async({page},info)=>{
    test.setTimeout(600_000);
    await page.goto('/tests/processing/index.html');await page.waitForFunction(()=>!!(window as unknown as HarnessWindow).__P1);
    await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.prime());
    const seconds=Number(process.env.P1_TIMING_SECONDS??60);
    await page.evaluate(seconds=>(window as unknown as HarnessWindow).__P1.synthetic(seconds*48000,48000,2,undefined,true),seconds);
    const report=await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.inspect());
    await info.attach('stage-timings',{body:JSON.stringify(report),contentType:'application/json'});
    console.log(JSON.stringify({metrics:report.metrics,timings:report.timings}));
    expect(report.originalPcmUnchanged).toBe(true);
    expect(report.artifacts.every(a=>a.frames===seconds*44100&&a.samplesIdentical&&a.summariesIdentical)).toBe(true);
    await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.clear());
});
