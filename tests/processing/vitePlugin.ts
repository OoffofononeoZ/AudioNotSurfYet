import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
// Dev-only fixture endpoint. Only four public pinned models are accessible.
export function processingFixturePlugin():Plugin {
    return {name:'processing-p1-public-model-fixtures',apply:'serve',configureServer(server){
        server.middlewares.use((request,response,next)=>{
            const probe=/^\/processing-probe\/([^/]+)$/.exec((request.url??'').split('?')[0]!);
            const probeFiles=new Set(['ort.all.min.mjs','ort.webgpu.min.mjs','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm','ort-wasm-simd-threaded.asyncify.mjs','ort-wasm-simd-threaded.asyncify.wasm','manifest.json','drums-window-f32.onnx','graph.json','drums-observe.onnx','observe.json']);
            if(probe&&probeFiles.has(probe[1]!)){
                const file=path.resolve('artifacts/fixtures/p1-probe',probe[1]!);
                if(!existsSync(file)){response.statusCode=404;response.end('Prepare the diagnostic fixtures first.');return;}
                response.setHeader('Content-Type',probe[1]!.endsWith('.mjs')?'text/javascript':probe[1]!.endsWith('.wasm')?'application/wasm':probe[1]!.endsWith('.json')?'application/json':'application/octet-stream');
                response.setHeader('Cache-Control','no-store');createReadStream(file).on('error',()=>response.destroy()).pipe(response);return;
            }
            const match=/^\/p1-models\/(htdemucs_ft_(?:drums|bass|other|vocals)_fp16weights\.onnx)$/.exec((request.url??'').split('?')[0]!);
            if(!match){next();return;}
            const file=path.resolve('artifacts/fixtures/p1-models',match[1]!);
            if(!existsSync(file)){response.statusCode=404;response.end('Run processing:models first.');return;}
            response.setHeader('Content-Type','application/octet-stream');
            createReadStream(file).on('error',()=>{response.destroy();}).pipe(response);
        });
    }};
}
