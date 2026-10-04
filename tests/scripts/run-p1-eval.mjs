import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root=process.cwd(),safe=root.replaceAll('\\','/');
function git(...args){const result=spawnSync('git',['-c',`safe.directory=${safe}`,...args],{encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);return result.stdout.trim();}
const commit=git('rev-parse','HEAD'),initialStatus=git('status','--porcelain'),provisional=process.argv.includes('--provisional');
if(initialStatus&&!provisional)throw Error('Canonical P1 eval requires a clean implementation commit. Use --provisional for feedback.');
const runId=`P1-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}-${commit.slice(0,8)}${provisional?'-provisional':''}`;
const directory=path.join(root,'artifacts/evals',runId);fs.mkdirSync(directory,{recursive:true});
const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
if(!fs.existsSync(npmCli))throw Error('Cannot locate npm CLI next to the active Node executable.');
const steps=[];
function run(name,args,env={}){
 const started=new Date().toISOString();
 const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:64*1024**2,env:{...process.env,...env}});
 fs.writeFileSync(path.join(directory,`${name}.log`),(result.stdout??'')+'\n'+(result.stderr??'')+(result.error?'\n'+String(result.error):''));
 const entry={name,args,started,finished:new Date().toISOString(),status:result.status===0?'pass':'fail',exitCode:result.status};steps.push(entry);console.log(`${name}: ${entry.status}`);
 return result.status===0;
}
const npm=(name,script)=>run(name,[npmCli,'run',script]);
npm('docs','test:docs');npm('runtime-assets','processing:assets');
const models=run('model-bytes',['tests/processing/download-models.mjs','--verify-only']);
npm('types','typecheck');npm('build','build');npm('unit','test:p1:unit');npm('integration','test:p1:integration');
run('regression',['node_modules/vitest/vitest.mjs','run','tests/audio/audio-engine.test.ts','tests/worker/m6-worker.test.ts','tests/analysis/m6-coordinator.integration.test.ts']);
if(models)for(const project of ['chrome','edge']){
 run(project,['node_modules/@playwright/test/cli.js','test','tests/e2e/p1-contracts.spec.ts','tests/e2e/p1-ft.spec.ts',`--project=${project}`,'--workers=1','--reporter=list,json'],
  {PLAYWRIGHT_JSON_OUTPUT_FILE:path.join(directory,`${project}.json`)});
 if(fs.existsSync('test-results'))fs.cpSync('test-results',path.join(directory,`${project}-results`),{recursive:true});
}
const gpu=spawnSync('nvidia-smi',['--query-gpu=name,memory.total,driver_version','--format=csv,noheader'],{encoding:'utf8'});
const endCommit=git('rev-parse','HEAD'),endStatus=git('status','--porcelain');
const unchanged=commit===endCommit&&initialStatus===endStatus;
const summary={schemaVersion:1,runId,kind:provisional?'provisional':'canonical',commit,initialStatus,endCommit,endStatus,unchanged,
 environment:{node:process.version,platform:process.platform,osRelease:os.release(),ramBytes:os.totalmem(),gpuDiscovery:gpu.status===0?gpu.stdout.trim():null},
 steps,passedSteps:steps.filter(s=>s.status==='pass').length,totalSteps:steps.length,
 milestoneStatus:'In Progress',closureEligible:false,
 unverified:['successful four-model WebGPU inference and isolated WASM parity if session creation fails','real FT stitching/export','three licensed songs / 12 owner listening conclusions','two-browser 15-minute reference performance and resource peaks','native WAV save/cancel/replay'],
};
const json=JSON.stringify(summary,null,2)+'\n';fs.writeFileSync(path.join(directory,'summary.json'),json);
const sha=createHash('sha256').update(json).digest('hex');fs.writeFileSync(path.join(directory,'summary.sha256'),sha+'\n');
console.log(JSON.stringify({runId,summarySha256:sha,passedSteps:summary.passedSteps,totalSteps:steps.length,unchanged,closureEligible:false}));
if(steps.some(s=>s.status==='fail')||!unchanged)process.exitCode=1;
