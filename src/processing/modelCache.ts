import { checkCancelled, ProcessingError } from './modelManifest';
import { Sha256 } from './sha256';
import { databaseGet, databasePut, yieldTask } from './storage';

export async function verifyBlob(blob:Blob,bytes:number,checksum:string,signal:AbortSignal):Promise<void> {
    if(blob.size!==bytes)throw new ProcessingError('model-checksum-mismatch','Model size mismatch.');
    const hash=new Sha256();
    for(let at=0;at<blob.size;at+=1024*1024){checkCancelled(signal);hash.update(new Uint8Array(await blob.slice(at,at+1024*1024).arrayBuffer()));await yieldTask();}
    checkCancelled(signal);
    if(hash.hex()!==checksum)throw new ProcessingError('model-checksum-mismatch','Model checksum mismatch.');
}
export interface ModelArtifact { bytes:number;sha256:string;url:string }
export async function loadModel(model:ModelArtifact,signal:AbortSignal,
    progress:(phase:'model-download'|'model-verify',done:number,total:number)=>void,
    url=model.url):Promise<{bytes:Uint8Array<ArrayBuffer>;cacheHit:boolean}> {
    const cached=await databaseGet<Blob>('models',model.sha256);
    if(cached){progress('model-verify',0,model.bytes);await verifyBlob(cached,model.bytes,model.sha256,signal);return {bytes:new Uint8Array(await cached.arrayBuffer()),cacheHit:true};}
    progress('model-download',0,model.bytes);
    let response:Response;
    try{response=await fetch(url,{signal});}catch{checkCancelled(signal);throw new ProcessingError('model-download-failed','Model download failed.');}
    if(!response.ok||!response.body)throw new ProcessingError('model-download-failed','Model download is unavailable.');
    const reader=response.body.getReader(),parts:Uint8Array<ArrayBuffer>[]=[],hash=new Sha256();let count=0;
    try{while(true){checkCancelled(signal);const {done,value}=await reader.read();if(done)break;
        count+=value.length;if(count>model.bytes)throw new ProcessingError('model-checksum-mismatch','Unexpected model size.');
        hash.update(value);parts.push(new Uint8Array(value));progress('model-download',count,model.bytes);await yieldTask();
    }}finally{await reader.cancel();reader.releaseLock();}
    checkCancelled(signal);progress('model-verify',count,model.bytes);
    if(count!==model.bytes||hash.hex()!==model.sha256)throw new ProcessingError('model-checksum-mismatch','Model checksum mismatch.');
    const blob=new Blob(parts);parts.length=0;
    await databasePut('models',model.sha256,blob,signal);
    return {bytes:new Uint8Array(await blob.arrayBuffer()),cacheHit:false};
}
