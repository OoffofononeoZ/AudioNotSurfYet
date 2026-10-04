import { expect } from '@playwright/test';
import { test } from '../processing/persistentFixture';
import type { P1Api } from '../processing/harness';
import { startSystemSampler,systemEnvironment } from '../processing/systemSampler';
type HarnessWindow={__P1:P1Api};
test('P1 fifteen-minute new four-stem job meets reference separation budget',async({page},info)=>{
    test.setTimeout(1_800_000);
    await page.goto('/tests/processing/index.html');await page.waitForFunction(()=>!!(window as unknown as HarnessWindow).__P1);
    await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.prime());
    const cdp=await page.context().newCDPSession(page),version=await cdp.send('Browser.getVersion');await cdp.detach();
    const environment={...await systemEnvironment(),browser:version.product,project:info.project.name,storageMode:'persistent-test-profile',estimate:await page.evaluate(()=>navigator.storage.estimate()),fixture:{frames:900*48000,sampleRate:48000,channels:2,durationSeconds:900,heldNativePcm:true}};
    expect(environment.gpu).toMatch(/RTX 4060 Laptop GPU/);
    const logs:string[]=[];page.on('console',message=>{if(message.type()==='error')logs.push(message.text());});
    const stopSampling=await startSystemSampler();let report;
    try{
        await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.synthetic(900*48000,48000,2,undefined,true));
        report=await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.inspect());
    }finally{
        const resources=await stopSampling();await info.attach('reference-performance',{body:JSON.stringify({environment,report,resources},null,2),contentType:'application/json'});
        await info.attach('failure-diagnostics',{body:logs.filter(l=>l.includes('FT failure diagnostic')).join('\n'),contentType:'text/plain'});
        await info.attach('controller-metrics',{body:JSON.stringify(await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.report())),contentType:'application/json'});
        console.log(JSON.stringify({project:info.project.name,metrics:report?.metrics,peakGpuMiB:resources.peakGpuUsedMiB,peakBrowserWS:resources.peakBrowserWorkingSetBytes}));
    }
    expect(report!.metrics!.downloadElapsedMs).toBe(0);expect(report!.metrics!.processingElapsedMs).toBeLessThan(900_000);
    expect(report!.metrics!.feedbackMs).toBeLessThanOrEqual(100);expect(report!.metrics!.maxHeartbeatGapMs).toBeLessThanOrEqual(1000);
    expect(report!.artifacts.every(a=>a.frames===900*44100&&a.samplesIdentical&&a.summariesIdentical)).toBe(true);
    await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.clear());
});
