const status = document.querySelector<HTMLPreElement>('#status')!;
const api = {
    probe(mode:'drums'|'drums-truncated'|'pitch'|'auxiliary'|'quality',maxTokens?:number):Promise<Record<string,unknown>> {
        return new Promise((resolve,reject) => {
            const worker = mode === 'quality' ? new Worker(new URL('./quality-probe.worker.ts',import.meta.url),{type:'module'})
                : new Worker(new URL('./model-probe.worker.ts',import.meta.url),{type:'module'});
            worker.onmessage = event => {
                status.textContent = JSON.stringify(event.data,null,2);
                if (event.data.type === 'progress') return;
                worker.terminate(); resolve(event.data);
            };
            worker.onerror = event => { worker.terminate(); reject(Error(event.message)); };
            worker.postMessage({mode,maxTokens});
        });
    },
};
(window as unknown as {__Transcription:typeof api}).__Transcription = api;
