import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root=process.cwd(),safe=root.replaceAll('\\','/');
function git(...args){
    const result=spawnSync('git',['-c',`safe.directory=${safe}`,...args],{encoding:'utf8'});
    if(result.status!==0)throw Error(result.stderr);return result.stdout.trim();
}
const commit=git('rev-parse','HEAD'),initialStatus=git('status','--porcelain');
const provisional=process.argv.includes('--provisional');
if(initialStatus&&!provisional)throw Error('Editor FT canonical requires a clean implementation commit.');
const runId=`EditorFT-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}-${commit.slice(0,8)}${provisional?'-provisional':''}`;
const directory=path.join(root,'artifacts/evals',runId);fs.mkdirSync(directory,{recursive:true});
const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
if(!fs.existsSync(npmCli))throw Error('Cannot locate npm CLI next to the active Node executable.');
const steps=[];
function run(name,args,env={}){
    const started=new Date().toISOString();
    const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:64*1024**2,env:{...process.env,...env}});
    fs.writeFileSync(path.join(directory,`${name}.log`),(result.stdout??'')+'\n'+(result.stderr??'')+(result.error?'\n'+String(result.error):''));
    const entry={name,args,started,finished:new Date().toISOString(),status:result.status===0?'pass':'fail',exitCode:result.status};
    steps.push(entry);console.log(`${name}: ${entry.status}`);return result.status===0;
}
const npm=(name,script)=>run(name,[npmCli,'run',script]);
npm('docs','test:docs');
npm('runtime-assets','processing:assets');
const models=run('model-bytes',['tests/processing/download-models.mjs','--verify-only']);
npm('types','typecheck');npm('build','build');
run('unit-and-integration',['node_modules/vitest/vitest.mjs','run',
    'tests/processing/editor-result-repository.test.ts','tests/processing/editor-separation-service.test.ts','tests/processing/editor-presentation.test.ts',
    'tests/processing/p1-storage.test.ts','tests/processing/p1-controller.test.ts','tests/processing/p1-kernel.test.ts',
    'tests/processing/p1-dsp.test.ts','tests/processing/p1-runtime.test.ts','tests/processing/p1-model-input.test.ts',
    'tests/editor/e9-tempo-lane-unit.test.ts','tests/editor/e10-marker-block-unit.test.ts','tests/editor/e10-marker-block.integration.test.ts',
    'tests/audio/audio-engine.test.ts']);
if(models)for(const project of ['chrome','edge']){
    run(project,['node_modules/@playwright/test/cli.js','test',
        'tests/e2e/editor-ft.spec.ts','tests/e2e/e10-editor-block-editing.spec.ts',
        'tests/e2e/e9-editor-tempo-lane.spec.ts','tests/e2e/e8-editor-usability.spec.ts','tests/e2e/e7-editor-compact.spec.ts',
        `--project=${project}`,'--workers=1','--reporter=list,json'],
        {PLAYWRIGHT_JSON_OUTPUT_FILE:path.join(directory,`${project}.json`),EDITOR_FT_ARTIFACT_DIR:path.join(directory,`${project}-media`)});
    if(fs.existsSync('test-results'))fs.cpSync('test-results',path.join(directory,`${project}-results`),{recursive:true});
}
const diff=spawnSync('git',['-c',`safe.directory=${safe}`,'diff','--check'],{encoding:'utf8'});
fs.writeFileSync(path.join(directory,'diff-check.log'),(diff.stdout??'')+(diff.stderr??''));
steps.push({name:'diff-check',status:diff.status===0?'pass':'fail',exitCode:diff.status});
const endCommit=git('rev-parse','HEAD'),endStatus=git('status','--porcelain');
const unchanged=commit===endCommit&&initialStatus===endStatus;
const browsers=Object.fromEntries(['chrome','edge'].map(project=>{
    const file=path.join(directory,`${project}.json`);
    const stats=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).stats:null;
    return [project,stats];
}));
const browserPasses=Object.values(browsers).every(stats=>stats&&stats.expected>=8&&stats.unexpected===0&&stats.skipped===0&&stats.flaky===0);
const mediaFiles=[];
for(const project of ['chrome','edge']){
    const media=path.join(directory,`${project}-media`);
    if(fs.existsSync(media))for(const file of fs.readdirSync(media)){
        const bytes=fs.readFileSync(path.join(media,file));
        mediaFiles.push({file:`${project}-media/${file}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    }
}
const summary={schemaVersion:1,runId,scope:'Editor FT integration / DEC-072',kind:provisional?'provisional':'canonical',
    commit,initialStatus,endCommit,endStatus,unchanged,environment:{node:process.version,platform:process.platform,osRelease:os.release()},
    steps,browsers,mediaFiles,passedSteps:steps.filter(step=>step.status==='pass').length,totalSteps:steps.length,
    integrationVerified:!provisional&&!initialStatus&&unchanged&&steps.length===9&&steps.every(step=>step.status==='pass')&&browserPasses,
    p1Closed:false,releaseReady:false,
    unverified:['P1 fifteen-minute performance (last Chrome 1011.9541s)','third listening song / twelve owner conclusions',
        'native OS WAV save/cancel/replay','production model network access in the owner browser'],
};
const json=JSON.stringify(summary,null,2)+'\n';fs.writeFileSync(path.join(directory,'summary.json'),json);
const sha=createHash('sha256').update(json).digest('hex');fs.writeFileSync(path.join(directory,'summary.sha256'),sha+'\n');
console.log(JSON.stringify({runId,summarySha256:sha,passedSteps:summary.passedSteps,totalSteps:steps.length,unchanged,integrationVerified:summary.integrationVerified}));
if(steps.some(step=>step.status==='fail')||!unchanged||!browserPasses)process.exitCode=1;
