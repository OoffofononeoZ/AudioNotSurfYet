import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import manifest from '../../src/transcription/model-artifacts.json';

export function transcriptionFixturePlugin():Plugin {
    const files = new Set(manifest.models.map(model => model.file));
    return {name:'transcription-public-model-fixtures',apply:'serve',configureServer(server) {
        server.middlewares.use((request,response,next) => {
            const match = /^\/transcription-models\/([^/]+)$/.exec((request.url ?? '').split('?')[0]!);
            if (!match || !files.has(match[1]!)) { next(); return; }
            const file = path.resolve('artifacts/fixtures/transcription-models',match[1]!);
            if (!existsSync(file)) { response.statusCode = 404; response.end('Prepare the pinned transcription models.'); return; }
            response.setHeader('Content-Type','application/octet-stream');
            response.setHeader('Access-Control-Allow-Origin','*');
            response.setHeader('Cache-Control','no-store');
            createReadStream(file).on('error',() => response.destroy()).pipe(response);
        });
    }};
}
