import { test,expect } from '@playwright/test';
for(const mode of ['jsep','jsep-disabled','native-disabled','native-window-f32','wasm','wasm-disabled'] as const)test(`FT drums diagnostic / ${mode}`,async({page},testInfo)=>{
    test.setTimeout(600_000);
    const logs:string[]=[];page.on('console',message=>logs.push(`${message.type()}: ${message.text()}`));
    await page.goto('/tests/processing/index.html');
    await page.waitForFunction(()=>!!(window as unknown as {__P1:unknown}).__P1);
    const result=await page.evaluate(async mode=>{
        return await (window as unknown as {__P1:{probe(mode:string,row:number):Promise<unknown>}}).__P1.probe(mode,0);
    },mode);
    await testInfo.attach('runtime-console',{body:logs.join('\n'),contentType:'text/plain'});
    await testInfo.attach('probe-result',{body:JSON.stringify(result,null,2),contentType:'application/json'});
    console.log(JSON.stringify(result));
    expect((result as {type:string}).type).toBe('result');
});
