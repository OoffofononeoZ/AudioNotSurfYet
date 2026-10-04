import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
// Dev-only fixture endpoint. Only four public pinned models are accessible.
export function processingFixturePlugin():Plugin {
    return {name:'processing-p1-public-model-fixtures',apply:'serve',configureServer(server){
        server.middlewares.use((request,response,next)=>{
            const match=/^\/p1-models\/(htdemucs_ft_(?:drums|bass|other|vocals)_fp16weights\.onnx)$/.exec((request.url??'').split('?')[0]!);
            if(!match){next();return;}
            const file=path.resolve('artifacts/fixtures/p1-models',match[1]!);
            if(!existsSync(file)){response.statusCode=404;response.end('Run processing:models first.');return;}
            response.setHeader('Content-Type','application/octet-stream');
            createReadStream(file).on('error',()=>{response.destroy();}).pipe(response);
        });
    }};
}
