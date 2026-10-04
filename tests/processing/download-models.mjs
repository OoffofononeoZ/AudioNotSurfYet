import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
if(process.platform==='win32'){
    const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','tests/processing/download-models.ps1',...(process.argv.includes('--verify-only')?['-VerifyOnly']:[])],{stdio:'inherit'});
    process.exit(result.status??1);
}
// The approved architecture table is the download authority; no floating refs.
const doc=await fs.readFile('docs/architecture/processing/model-artifacts.md','utf8');
const rows=doc.split('\n').filter(line=>/^\| (drums|bass|other|vocals) \/ /.test(line));
const directory='artifacts/fixtures/p1-models';
await fs.mkdir(directory,{recursive:true});
const results=[];
for(const line of rows){
 const [,role,repository,revision,file,size,sha]=line.split('|').map(v=>v.trim().replaceAll('`',''));
 const specialist=role.split(' / ')[0];
 if(file!==`htdemucs_ft_${specialist}_fp16weights.onnx`||repository!==`StemSplitio/htdemucs-ft-${specialist}-onnx`||!/^[a-f0-9]{40}$/.test(revision)||!/^[a-f0-9]{64}$/.test(sha)||Number(size)!==165612636)throw Error('Invalid approved model identity.');
 const target=`${directory}/${file}`,expected=Number(size);
 async function verify(){const data=await fs.readFile(target);return data.length===expected&&createHash('sha256').update(data).digest('hex')===sha;}
 let cached=false;try{cached=await verify()}catch{}
 if(!cached){
  if(process.argv.includes('--verify-only'))throw Error(`${role} fixture missing or corrupt; run processing:models before eval.`);
  const response=await fetch(`https://huggingface.co/${repository}/resolve/${revision}/${file}`);
  if(!response.ok)throw Error(`${role}: HTTP ${response.status}`);
  const handle=await fs.open(target+'.partial','w');const hash=createHash('sha256');let bytes=0;
  try{for await(const chunk of response.body){await handle.write(chunk);hash.update(chunk);bytes+=chunk.length;}if(bytes!==expected||hash.digest('hex')!==sha)throw Error(`${role}: checksum/size mismatch`);}finally{await handle.close();}
  await fs.rename(target+'.partial',target);
 }
 results.push({role:role.split(' / ')[0],revision,file,bytes:expected,sha256:sha,cached});console.log(`${role}: verified ${expected} bytes`);
}
if(results.length!==4)throw Error('Approved table missing four models.');
await fs.writeFile(`${directory}/verified.json`,JSON.stringify(results,null,2)+'\n');
