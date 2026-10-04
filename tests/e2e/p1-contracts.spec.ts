import { test,expect } from '@playwright/test';
test('P1 unsupported GPU and twenty cancelled job lifecycles preserve browser playback ownership',async({page})=>{
    await page.addInitScript(()=>{
        Object.defineProperty(navigator,'gpu',{value:undefined});
        const NativeWorker=window.Worker;let workers=0,contexts=0;
        window.Worker=class extends NativeWorker{constructor(url:string|URL,options?:WorkerOptions){super(url,options);workers++;}override terminate(){workers--;super.terminate();}};
        const NativeAudioContext=window.AudioContext;
        window.AudioContext=class extends NativeAudioContext{constructor(options?:AudioContextOptions){super(options);contexts++;}};
        Object.defineProperty(window,'__p1Resources',{get:()=>({workers,contexts})});
    });
    await page.goto('/tests/processing/index.html?gpu=unavailable');await page.waitForFunction(()=>!!(window as unknown as {__P1:unknown}).__P1);
    const results=await page.evaluate(async()=>{
        const api=(window as unknown as {__P1:{synthetic(frames:number):Promise<unknown>;cancel():void}}).__P1;
        const errors:string[]=[];
        for(let i=0;i<20;i++){
            const promise=api.synthetic(20000).catch(error=>errors.push(error.code));
            if(i%2===0)api.cancel();await promise;
        }
        return {errors,resources:(window as unknown as {__p1Resources:{workers:number;contexts:number}}).__p1Resources};
    });
    expect(results.errors).toHaveLength(20);expect(results.errors.filter(e=>e==='webgpu-unavailable')).toHaveLength(10);
    expect(results.errors.filter(e=>e==='job-cancelled')).toHaveLength(10);expect(results.resources).toEqual({workers:0,contexts:0});
});
