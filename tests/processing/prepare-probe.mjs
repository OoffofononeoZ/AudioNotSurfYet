import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const assets=[];
for(const file of ['ort.all.min.mjs','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm','ort.webgpu.min.mjs','ort-wasm-simd-threaded.asyncify.mjs','ort-wasm-simd-threaded.asyncify.wasm']){
    const bytes=await fs.readFile(`node_modules/onnxruntime-web/dist/${file}`);
    await fs.mkdir('artifacts/fixtures/p1-probe',{recursive:true});
    await fs.writeFile(`artifacts/fixtures/p1-probe/${file}`,bytes);
    assets.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await fs.writeFile('artifacts/fixtures/p1-probe/manifest.json',JSON.stringify({version:'1.30.0',assets},null,2));
console.log(JSON.stringify(assets));
