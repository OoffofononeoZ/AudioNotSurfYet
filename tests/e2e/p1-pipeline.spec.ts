import { test,expect } from '@playwright/test';
import type { P1Api } from '../processing/harness';
type HarnessWindow=Window&{__P1:P1Api};
test('P1 original four-model pipeline preserves PCM and exports independently verified WAV/summary',async({page},info)=>{
    test.setTimeout(600_000);
    await page.goto('/tests/processing/index.html');await page.waitForFunction(()=>!!(window as unknown as HarnessWindow).__P1);
    // Both padded short stereo and a 48k mono case crossing the 25% overlap.
    for(const [frames,rate,channels] of [[20000,44100,2],[400003,48000,1]]){
        await page.evaluate(async({frames,rate,channels})=>{await (window as unknown as HarnessWindow).__P1.synthetic(frames!,rate!,channels!);},{frames,rate,channels});
        const report=await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.inspect());
        await info.attach(`pipeline-${rate}-${channels}`,{body:JSON.stringify(report,null,2),contentType:'application/json'});
        console.log(JSON.stringify({frames,rate,metrics:report.metrics}));
        expect(report.artifacts.map(a=>a.role)).toEqual(['drums','bass','other','vocals']);
        expect(report.artifacts.every(a=>a.frames===Math.round(frames!/rate!*44100)&&a.samplesIdentical&&a.summariesIdentical&&a.nonzero>0)).toBe(true);
        expect(report.timeline.map(t=>`${t.role}:${t.event}`)).toEqual(['drums:load','drums:release','bass:load','bass:release','other:load','other:release','vocals:load','vocals:release']);
        expect(report.residuals).toEqual([]);expect(report.metrics!.terminalCount).toBe(1);
        expect(report.metrics!.feedbackMs).toBeLessThanOrEqual(100);expect(report.metrics!.maxHeartbeatGapMs).toBeLessThanOrEqual(1000);
        await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.clear());
    }
});
test('P1 real FT cancellation terminates once in each pipeline phase within cleanup deadline',async({page},info)=>{
    test.setTimeout(900_000);
    await page.addInitScript(()=>{
        const NativeWorker=window.Worker;let workers=0,contexts=0;
        window.Worker=class extends NativeWorker{private ended=false;constructor(url:string|URL,options?:WorkerOptions){super(url,options);workers++;}override terminate(){if(!this.ended){this.ended=true;workers--;}super.terminate();}};
        const NativeContext=window.AudioContext;window.AudioContext=class extends NativeContext{constructor(options?:AudioContextOptions){super(options);contexts++;}};
        Object.defineProperty(window,'__p1Resources',{get:()=>({workers,contexts})});
    });
    await page.goto('/tests/processing/index.html');await page.waitForFunction(()=>!!(window as unknown as HarnessWindow).__P1);await page.evaluate(()=>(window as unknown as HarnessWindow).__P1.prime());
    const phases=['pcm-staging','model-load','inference','stitch','derive','persist',...Array.from({length:14},(_,i)=>i%2===0?'pcm-staging':'inference')];
    for(const [cycle,phase] of phases.entries()){
        const report=await page.evaluate(async phase=>{
            const api=(window as unknown as HarnessWindow).__P1;let code='unexpected-success';
            try{await api.synthetic(400003,48000,1,phase);}catch(e){code=(e as {code:string}).code;}
            return {code,...api.report(),resources:(window as unknown as {__p1Resources:{workers:number;contexts:number}}).__p1Resources};
        },phase);
        await info.attach(`cancel-${cycle}-${phase}`,{body:JSON.stringify(report,null,2),contentType:'application/json'});
        expect(report.code).toBe('job-cancelled');expect(report.separating).toBe(false);
        expect(report.metrics!.terminalCount).toBe(1);expect(report.metrics!.cancelMs).not.toBeNull();expect(report.metrics!.cancelMs!).toBeLessThanOrEqual(5000);
        expect(report.resources).toEqual({workers:0,contexts:0});
    }
});

