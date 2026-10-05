import { inject,type InjectionKey } from 'vue';
import type { DecodedAudioCopyPort } from '../analysis/pcm';
import type { SeparationResult } from './kernel';
import { SeparationController } from './controller';
import { EditorStemRepository,type EditorStemRepositoryPort,type ProcessingStorageSummary } from './editorResultRepository';
import { checkCancelled,ProcessingError } from './modelManifest';
import type { StemRole } from './modelManifest';
import type { WorkerEvent } from './workerProtocol';

export type EditorSeparationStatus='idle'|'restoring'|'running'|'cancelling'|'ready'|'cancelled'|'error'|'clearing';
export interface EditorSeparationSnapshot {
    trackId:string|null;status:EditorSeparationStatus;result:SeparationResult|null;urls:Partial<Record<StemRole,string>>;
    progress:Extract<WorkerEvent,{type:'progress'}>|null;role:StemRole|null;restored:boolean;
    message:string|null;errorCode:string|null;storage:ProcessingStorageSummary|null;cacheLimit:number;
}
type ControllerPort=Pick<SeparationController,'start'|'cancel'>;
const busyStatuses=new Set<EditorSeparationStatus>(['restoring','running','cancelling','clearing']);
const errors:Record<string,string>={
    'webgpu-unavailable':'此浏览器无法使用硬件WebGPU。你仍可继续播放和手动标记。',
    'model-download-failed':'模型下载失败，请检查网络后重试。',
    'model-checksum-mismatch':'模型校验失败。请清理模型缓存后重新下载。',
    'model-incompatible':'模型无法在当前浏览器初始化。请保留手动编辑并检查浏览器与显卡支持。',
    'runtime-asset-mismatch':'处理运行文件缺失或校验失败，请重新准备应用资源。',
    'cache-full':'已达到分离缓存上限。请显式清理结果或调整上限后重试。',
    'quota-exceeded':'浏览器存储空间不足，请显式清理缓存后重试。',
    'storage-unavailable':'浏览器本地存储不可用，请检查站点存储权限。',
    'source-identity-mismatch':'歌曲已经改变，本次结果没有应用。',
    'inference-failed':'分离未能完成。你可以重试，或继续原曲播放和手动编辑。',
};
export class EditorSeparationService {
    private readonly controller:ControllerPort;private readonly repository:EditorStemRepositoryPort;
    private listeners=new Set<(snapshot:EditorSeparationSnapshot)=>void>();private generation=0;private io:AbortController|null=null;
    private operation:Promise<void>|null=null;private binding:Promise<void>|null=null;private disposed=false;
    private state:EditorSeparationSnapshot={trackId:null,status:'idle',result:null,urls:{},progress:null,role:null,restored:false,message:null,errorCode:null,storage:null,cacheLimit:10*1024**3};
    private readonly port:DecodedAudioCopyPort;
    constructor(port:DecodedAudioCopyPort,options:{controller?:ControllerPort;repository?:EditorStemRepositoryPort;createUrl?:(blob:Blob)=>string;revokeUrl?:(url:string)=>void}={}){
        this.port=port;
        this.controller=options.controller??new SeparationController();this.repository=options.repository??new EditorStemRepository();
        this.createUrl=options.createUrl??(blob=>URL.createObjectURL(blob));this.revokeUrl=options.revokeUrl??(url=>URL.revokeObjectURL(url));
        try{const limit=Number(localStorage.getItem('editor-ft-cache-limit'));if(Number.isFinite(limit)&&limit>=1024**3&&limit<=100*1024**3)this.state.cacheLimit=limit;}catch{/* Settings are optional; quota remains enforced. */}
    }
    private createUrl:(blob:Blob)=>string;private revokeUrl:(url:string)=>void;
    getSnapshot():EditorSeparationSnapshot{return {...this.state,urls:{...this.state.urls}};}
    subscribe(listener:(snapshot:EditorSeparationSnapshot)=>void):()=>void{this.listeners.add(listener);listener(this.getSnapshot());return()=>this.listeners.delete(listener);}
    private update(patch:Partial<EditorSeparationSnapshot>):void{this.state={...this.state,...patch};for(const listener of this.listeners)listener(this.getSnapshot());}
    private revoke():void{for(const url of Object.values(this.state.urls))this.revokeUrl(url);this.state.urls={};}
    private guard(generation:number,signal:AbortSignal):void{checkCancelled(signal);if(this.disposed||generation!==this.generation)throw new ProcessingError('job-cancelled','已取消。');}
    private guardedPort(trackId:string):DecodedAudioCopyPort{
        return {getDecodedAudioDescriptor:()=>{const d=this.port.getDecodedAudioDescriptor();return d?.trackId===trackId?d:null;},copyDecodedChannelRange:input=>this.port.getDecodedAudioDescriptor()?.trackId===trackId?this.port.copyDecodedChannelRange(input):null};
    }
    async bind(trackId:string|null):Promise<void>{
        if(this.disposed)return;if(trackId===this.state.trackId&&trackId!==null)return;
        const generation=++this.generation;this.io?.abort();this.controller.cancel();this.revoke();
        this.update({trackId,status:trackId?'restoring':'idle',result:null,urls:{},progress:null,role:null,restored:false,message:null,errorCode:null});
        const abort=new AbortController();this.io=abort;
        const work=(async()=>{
            try{await this.operation;this.guard(generation,abort.signal);if(!trackId)return;
                const storage=await this.repository.summary();this.guard(generation,abort.signal);this.update({storage});
                const result=await this.repository.restore(this.guardedPort(trackId),abort.signal);this.guard(generation,abort.signal);
                if(result)await this.show(result,generation,abort.signal,true);else this.update({status:'idle'});
            }catch(error){if(generation===this.generation&&!this.disposed){const code=error instanceof ProcessingError?error.code:'storage-unavailable';this.update({status:code==='job-cancelled'?'cancelled':'error',errorCode:code,message:code==='job-cancelled'?'已取消结果校验。':errors[code]??(error instanceof Error?error.message:'无法恢复分离结果。')});}}
        })();this.binding=work;await work;
    }
    private async show(result:SeparationResult,generation:number,signal:AbortSignal,restored:boolean):Promise<void>{
        const urls:Partial<Record<StemRole,string>>={};
        try{for(const stem of result.stems){const blob=await this.repository.wav(result,stem.role);this.guard(generation,signal);urls[stem.role]=this.createUrl(blob);}this.guard(generation,signal);
            this.revoke();this.update({result,urls,status:'ready',restored,message:null,errorCode:null});
        }catch(error){for(const url of Object.values(urls))this.revokeUrl(url);throw error;}
    }
    async start():Promise<void>{
        if(this.disposed||!this.state.trackId||busyStatuses.has(this.state.status)||this.operation)return;
        const generation=this.generation,trackId=this.state.trackId,abort=new AbortController();this.io=abort;
        this.update({status:'running',progress:null,role:null,message:null,errorCode:null,restored:false});
        let result:SeparationResult|undefined;
        const work=(async()=>{
            try{
                result=await this.controller.start(this.guardedPort(trackId),event=>{
                    if(generation!==this.generation||abort.signal.aborted)return;
                    if(event.type==='progress')this.update({progress:event,...(event.phase==='model-load'?{role:['drums','bass','other','vocals'][event.completedUnits] as StemRole}:{})});
                },undefined,{editor:true,cacheLimit:this.state.cacheLimit});this.guard(generation,abort.signal);
                if(JSON.stringify(this.port.getDecodedAudioDescriptor())!==JSON.stringify(result.source.descriptor))throw new ProcessingError('source-identity-mismatch','歌曲已经改变。');
                await this.repository.publish(result,abort.signal,(done,total)=>{
                    if(this.state.progress&&generation===this.generation&&!abort.signal.aborted)this.update({progress:{...this.state.progress,phase:'result-verify',completedUnits:done,totalUnits:total}});
                });this.guard(generation,abort.signal);
                await this.show(result,generation,abort.signal,false);
            }catch(error){
                if(result)try{await this.repository.discard(result.source.directory);}catch{/* Explicit cleanup remains available. */}
                if(generation===this.generation&&!this.disposed){const code=error instanceof ProcessingError?error.code:'inference-failed';this.update({status:code==='job-cancelled'?'cancelled':'error',errorCode:code,message:code==='job-cancelled'?'已取消本次分离，已有结果保留。':errors[code]??(error instanceof Error?error.message:'分离失败。')});}
            }finally{if(generation===this.generation&&!this.disposed)try{this.update({storage:await this.repository.summary()});}catch{/* Keep the task outcome if accounting fails. */}}
        })();this.operation=work;await work;if(this.operation===work)this.operation=null;
    }
    cancel():void{if(!['running','restoring'].includes(this.state.status))return;this.io?.abort();this.controller.cancel();this.update({status:'cancelling',message:'正在取消并清理本次任务…'});}
    setCacheLimit(bytes:number):void{
        if(busyStatuses.has(this.state.status))return;
        if(!Number.isFinite(bytes)||bytes<1024**3||bytes>100*1024**3)throw new ProcessingError('invalid-request','缓存上限需在1–100GiB之间。');
        this.update({cacheLimit:bytes});try{localStorage.setItem('editor-ft-cache-limit',String(bytes));}catch{/* Quota enforcement does not depend on localStorage. */}
    }
    async clear(kind:'results'|'models'):Promise<void>{
        if(this.disposed||busyStatuses.has(this.state.status)||this.operation)return;
        const generation=this.generation,abort=new AbortController();this.io=abort;this.update({status:'clearing',message:null});
        const work=(async()=>{try{
            if(kind==='results'){this.revoke();this.update({result:null,urls:{}});await this.repository.clearResults();this.guard(generation,abort.signal);this.update({status:'idle',message:'分离结果已清理，标记工程保持不变。'});}
            else{await this.repository.clearModels();this.guard(generation,abort.signal);this.update({status:this.state.result?'ready':'idle',message:'模型缓存已清理，下次分离将重新下载。'});}
            const storage=await this.repository.summary();this.guard(generation,abort.signal);this.update({storage});
        }catch(error){if(generation===this.generation&&!this.disposed)this.update({status:'error',errorCode:'cleanup-failed',message:error instanceof Error?error.message:'缓存清理失败。'});}})();
        this.operation=work;await work;if(this.operation===work)this.operation=null;
    }
    async dispose():Promise<void>{this.disposed=true;++this.generation;this.io?.abort();this.controller.cancel();this.revoke();await this.operation;await this.binding;this.listeners.clear();}
}
export const editorSeparationServiceKey:InjectionKey<EditorSeparationService>=Symbol('EditorSeparationService');
export function useEditorSeparationService():EditorSeparationService{const service=inject(editorSeparationServiceKey);if(!service)throw Error('Editor separation service is missing.');return service;}
