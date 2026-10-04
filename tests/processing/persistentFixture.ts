import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test as base } from '@playwright/test';

// Disk-backed OPFS for large fixtures. Default isolated contexts use ephemeral
// storage with a smaller real quota than the privacy-rounded estimate reports.
export const test=base.extend({
    context:async({playwright},use,info)=>{
        if(!['chrome','edge'].includes(info.project.name))throw Error('P1 requires real Chrome or Edge.');
        const workspace=fs.realpathSync(process.cwd()),root=path.join(workspace,'artifacts','browser-profiles');fs.mkdirSync(root,{recursive:true});
        const realRoot=fs.realpathSync(root),relativeRoot=path.relative(workspace,realRoot);
        if(relativeRoot.startsWith('..')||path.isAbsolute(relativeRoot))throw Error('Profile root is outside workspace.');
        const profile=path.join(realRoot,`${info.project.name}-${randomUUID()}`);fs.mkdirSync(profile);
        const context=await playwright.chromium.launchPersistentContext(profile,{channel:info.project.name==='edge'?'msedge':'chrome',headless:true,baseURL:info.project.use.baseURL,viewport:{width:1280,height:720}});
        await context.tracing.start({screenshots:true,snapshots:true,sources:true});
        try{await use(context);}finally{
            if(info.status!==info.expectedStatus){const trace=info.outputPath('persistent-trace.zip');await context.tracing.stop({path:trace});await info.attach('persistent-trace',{path:trace,contentType:'application/zip'});}else await context.tracing.stop();
            await context.close();
            // Remove only this newly-created test profile, using one filesystem
            // API and a checked resolved absolute path; never a user profile.
            const resolved=fs.realpathSync(profile),relative=path.relative(realRoot,resolved);
            if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Unsafe profile cleanup target.');
            fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:1000});
        }
    },
});
test.use({trace:'off'});
