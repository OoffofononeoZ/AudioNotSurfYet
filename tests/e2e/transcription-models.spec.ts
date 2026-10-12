import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { startSystemSampler } from '../processing/systemSampler';

test.describe('Editor real browser transcription models',() => {
    for (const mode of ['pitch','drums','drums-truncated','auxiliary'] as const) {
        test(`${mode}: locked model actual Worker inference`,async({page},testInfo) => {
            test.setTimeout(600000);
            const logs:string[] = [];
            page.on('console',message => logs.push(`${message.type()}: ${message.text()}`));
            page.on('pageerror',error => logs.push(`pageerror: ${error.message}`));
            await page.goto('/tests/transcription/index.html');
            await page.waitForFunction(() => !!(window as unknown as {__Transcription:unknown}).__Transcription);
            const stopSampler = await startSystemSampler();
            let answer:Record<string,unknown>|undefined;
            let memory:Awaited<ReturnType<typeof stopSampler>>;
            try {
                answer = await page.evaluate(async mode => (window as unknown as {
                    __Transcription:{probe(mode:'pitch'|'drums'|'drums-truncated'|'auxiliary'):Promise<Record<string,unknown>>}
                }).__Transcription.probe(mode),mode);
            } finally { memory = await stopSampler(); }
            const sourceFiles = ['src/transcription/model-artifacts.json','src/transcription/modelManifest.ts',
                'src/transcription/drumFeatures.ts','src/transcription/drumTokens.ts','src/transcription/drumModel.ts',
                'src/transcription/pitchModel.ts','src/transcription/pitchNotes.ts','src/transcription/monoResampler.ts',
                'tests/transcription/model-probe.worker.ts','tests/e2e/transcription-models.spec.ts'];
            const sourceHashes = await Promise.all(sourceFiles.map(async path => ({path,sha256:createHash('sha256').update(await fs.readFile(path)).digest('hex')})));
            const evidence = {recordedAt:new Date().toISOString(),project:testInfo.project.name,
                userAgent:await page.evaluate(() => navigator.userAgent),kind:'working-tree-provisional',sourceHashes,answer,memory};
            const directory = 'artifacts/evals/editor-transcription/model-runs';
            await fs.mkdir(directory,{recursive:true});
            await fs.writeFile(`${directory}/${testInfo.project.name}-${mode}-${Date.now()}.json`,JSON.stringify(evidence,null,2));
            await testInfo.attach('model-result',{body:JSON.stringify(answer,null,2),contentType:'application/json'});
            await testInfo.attach('memory',{body:JSON.stringify(memory,null,2),contentType:'application/json'});
            await testInfo.attach('runtime-console',{body:logs.join('\n'),contentType:'text/plain'});
            expect(answer.type,JSON.stringify(answer)).toBe('result');
            const result = answer.result as Record<string,any>;
            expect(result.backend).toBe(mode === 'auxiliary' ? 'webgpu' : 'wasm');
            expect(result.totalMs).toBeGreaterThan(0);
            if (mode === 'drums' || mode === 'drums-truncated') {
                expect(result.featureShape).toEqual([1,246,128]);
                expect(result.tokens[0]).toBe(2);
                expect(result.truncated).toBe(mode === 'drums-truncated');
                if (mode === 'drums') {
                    expect(result.tokens.at(-1)).toBe(3);
                    expect(result.hits.length).toBeGreaterThan(0);
                } else expect(result.tokens.length).toBe(4);
                expect(result.hits.every((hit:any) => ['kick','snare','hat'].includes(hit.drum) && hit.startSeconds >= 0 && hit.startSeconds < 2.56)).toBe(true);
            } else {
                expect(result.outputs.every((output:any) => output.finite)).toBe(true);
                if (mode === 'pitch') {
                    expect(result.outputs.map((output:any) => output.dims).sort()).toEqual([[1,172,264],[1,172,88],[1,172,88]].sort());
                    expect(result.pitch69Peak).toBeGreaterThan(0.3);
                    expect(result.transcription.windows).toBeGreaterThan(1);
                    expect(result.transcription.notes.some((note:any) => note.pitch === 69)).toBe(true);
                    expect(result.transcription.notes.every((note:any) => note.startSeconds >= 0 && note.endSeconds <= 6 && note.endSeconds > note.startSeconds)).toBe(true);
                    expect(result.maximumReadFrames).toBeLessThan(90000);
                } else {
                    expect(result.adapter.description).not.toMatch(/swiftshader|software|llvmpipe/i);
                    expect(result.outputs[0].dims).toEqual([1,6,2,343980]);
                }
            }
        });
    }
});
