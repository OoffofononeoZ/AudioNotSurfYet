import { P1_PARITY_LIMIT } from '../processing/acceptance';
import { test,expect } from '@playwright/test';
import fs from 'node:fs';
test.describe('P1 real FT graphs',()=>{
    for(let row=0;row<4;row++)test(`role ${row}: hardware WebGPU and isolated WASM parity`,async({page},testInfo)=>{
        test.setTimeout(600_000);
        expect(fs.existsSync('artifacts/fixtures/p1-models/verified.json'),'Run processing:models first.').toBe(true);
        const logs:string[]=[];page.on('console',message=>logs.push(`${message.type()}: ${message.text()}`));
        page.on('pageerror',error=>logs.push(`pageerror: ${error.message}`));
        await page.goto('/tests/processing/index.html');
        await page.waitForFunction(()=>!!(window as unknown as {__P1:unknown}).__P1);
        const answer=await page.evaluate(async row=>{
            return await (window as unknown as {__P1:{compat(row:number,variant?:string):Promise<Record<string,unknown>>}}).__P1.compat(row.row,row.variant);
        },{row,variant:process.env.P1_GPU_VARIANT});
        await testInfo.attach('runtime-console',{body:logs.join('\n'),contentType:'text/plain'});
        await testInfo.attach('compatibility',{body:JSON.stringify(answer,null,2),contentType:'application/json'});
        expect(answer.type,JSON.stringify({...answer,result:{...answer.result as object,steps:undefined}})).toBe('result');
        const result=answer.result as {parityPassed:boolean;maxError:number;parityLimit:number;runtimePatch:unknown;adapter:{description:string};steps:Array<{kernelCounts?:Record<string,number>}>};
        expect(result.parityLimit).toBe(P1_PARITY_LIMIT);if(!process.env.P1_GPU_VARIANT)expect(result.runtimePatch).toBeNull();
        expect(result.adapter.description).not.toMatch(/swiftshader|software|llvmpipe/i);
        expect(result.steps.some(s=>(s.kernelCounts?.Conv??0)>0&&(s.kernelCounts?.ConvTranspose??0)>0),'actual GPU neural/spectral kernel profiles').toBe(true);
        console.log(JSON.stringify({role:row,maxError:result.maxError}));
        expect(result.parityPassed,`role=${row}, maxError=${result.maxError}`).toBe(true);expect(result.maxError).toBeLessThanOrEqual(P1_PARITY_LIMIT);
    });
});
