import { inject, type InjectionKey } from 'vue';
import type { AudioSessionService, RoutePlaybackLease } from '../audio/audioSessionService';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type { AnalysisConsumerLease, AnalysisCoordinator } from '../analysis/analysisCoordinator';
import type { AnalysisCoordinatorSnapshot } from '../analysis/types';
import type { EditorDraftRepositoryPort } from '../editor/editorDraftRepository';
import type { EditorFileGateway } from '../editor/fileIO';
import { EditorFormatCodecRegistry, validateEditorProjectV1 } from '../editor/projectCodec';
import { createComposition, validateComposition, encodeComposition, decodeComposition, compositionFileFormat } from './compositionCodec';
import { CompositionResolver } from './compositionResolver';
import { CompositionDraftWriter } from './compositionDraftWriter';
import type { CompositionDraftRepositoryPort } from './compositionDraftRepository';
import { compositionIssues, planCompositionFeatures, removeCompositionElement, reorderComposition } from './compositionModel';
import { elementRegistry } from './elementRegistry';
import { createPresetElements, type CompositionPresetId } from './compositionPresets';
import { parameterKey } from './compositionEffects';
import type { ElementType, VisualizerElement, ElementBinding, VisualizerProjectV3, CompositionSessionSnapshot } from './compositionTypes';
import type { VisualizerTrackValidationContext, VisualizerResolution, VisualizerFrameRate } from './types';
import type { VisualizerResolvedParameterMap, VisualizerRendererStatus } from './rendererTypes';
import type { VisualizerFileGateway } from './fileIO';
import { NativeVisualizerVideoFileGateway, type VisualizerVideoFileGateway } from './videoFileIO';
import { VisualizerRecordingSession, type VisualizerRecordingSessionOptions, type VisualizerRecordingTarget } from './visualizerRecordingSession';

const initial=():CompositionSessionSnapshot=>({state:'empty',routeTrackId:null,activeTrackId:null,project:null,conflictingDraft:null,unsupportedDraft:null,
    persistence:'clean',restoredFromDraft:false,recording:{status:'idle'},bindingRuntime:{bindingRevision:0,activeFeatureIds:[],readyFeatureIds:[],analysisState:'idle',analysisProgress:0,editorSnapshotSource:'none'}});
export interface VisualizerSessionControllerOptions {
    audioSession:AudioSessionService;
    store:ReturnType<typeof useAudioSessionStore>;
    repository:CompositionDraftRepositoryPort;
    fileGateway:VisualizerFileGateway;
    analysisCoordinator?:AnalysisCoordinator;
    editorRepository?:EditorDraftRepositoryPort;
    editorFileGateway?:EditorFileGateway;
    videoGateway?:VisualizerVideoFileGateway;
    recordingRuntime?:Pick<VisualizerRecordingSessionOptions,'createRecorder'|'createMediaStream'|'isTypeSupported'|'isPresetAvailable'>;
    windowTarget?:Pick<Window,'addEventListener'|'removeEventListener'>;
}
export class VisualizerRecordingLockedError extends Error {
    readonly code='recording-locked';
    constructor(){super('录制准备、进行或收尾期间不能修改工程。');}
}
export class VisualizerSessionController {
    private options:VisualizerSessionControllerOptions;
    private snapshot=initial();
    private listeners=new Set<(snapshot:CompositionSessionSnapshot)=>void>();
    private playbackLease:RoutePlaybackLease|null=null;
    private analysisLease:AnalysisConsumerLease|null=null;
    private unsubscribeAnalysis:(()=>void)|null=null;
    private resolver=new CompositionResolver();
    private writer:CompositionDraftWriter;
    private recording:VisualizerRecordingSession;
    private generation=0;
    private ioGeneration=0;
    private editorIoGeneration=0;
    private disposed=false;
    private windowTarget?:Pick<Window,'addEventListener'|'removeEventListener'>;
    private beforeUnload=false;
    constructor(options:VisualizerSessionControllerOptions) {
        this.options=options;this.windowTarget=options.windowTarget ?? (typeof window==='undefined'?undefined:window);
        this.writer=new CompositionDraftWriter(options.repository,(persistence,project,message)=>{
            if(this.snapshot.project?.projectId!==project.projectId || this.disposed)return;
            this.publish({...this.snapshot,persistence,state:persistence==='not-persisted'?'not-persisted':'ready',message:persistence==='not-persisted'?'草稿未保存：'+message:undefined});
        });
        this.recording=new VisualizerRecordingSession({...options.recordingRuntime,audioSession:options.audioSession,videoGateway:options.videoGateway ?? new NativeVisualizerVideoFileGateway(),
            readContext:()=>({state:this.snapshot.state,activeTrackId:this.snapshot.activeTrackId,project:this.snapshot.project,bindingRuntime:this.snapshot.bindingRuntime,
                resolvedValues:[...this.resolveValuesAt(0).values(),...(this.snapshot.project?compositionIssues(this.snapshot.project):[]).map(message=>({parameterId:'configuration',state:'error' as const,message}))]}),
            onState:recording=>{if(!this.disposed)this.publish({...this.snapshot,recording});}});
        this.windowTarget?.addEventListener('pagehide',this.handlePageHide);
    }
    getSnapshot(){return structuredClone(this.snapshot);}
    readProject(){return this.snapshot.project;}
    subscribe(listener:(snapshot:CompositionSessionSnapshot)=>void){this.listeners.add(listener);listener(this.getSnapshot());return()=>this.listeners.delete(listener);}
    private publish(snapshot:CompositionSessionSnapshot){this.snapshot=snapshot;for(const listener of this.listeners)listener(this.getSnapshot());this.syncBeforeUnload();}
    private assertUnlocked(){if(this.recording.isLocked())throw new VisualizerRecordingLockedError();}
    hasActivePlaybackLease(){return !!this.playbackLease;}
    hasPendingWrite(){return this.writer.hasPending();}
    isRecordingLocked(){return this.recording.isLocked();}
    hasUnresolvedRecordingOutput(){return this.recording.hasUnresolvedOutput();}
    attachRecordingTarget(target:VisualizerRecordingTarget){return this.recording.attachTarget(target);}
    notifyRendererStatus(status:VisualizerRendererStatus){this.recording.notifyRendererStatus(status);}
    startRecording(){return this.recording.start();}
    cancelRecording(){return this.recording.cancel();}
    saveRecording(){return this.recording.save();}
    discardRecording(){this.recording.discard();}
    resetRecordingError(){this.recording.resetError();}
    getReadyRecordingBlobForDiagnostics(){return this.recording.getReadyBlobForDiagnostics();}
    async togglePlayback(){this.assertUnlocked();await this.options.audioSession.togglePlayback();}
    async seek(seconds:number){this.assertUnlocked();await this.options.audioSession.seek(seconds);}
    private context(trackId=this.snapshot.activeTrackId):VisualizerTrackValidationContext|null {
        const track=this.options.store.queue.find(t=>t.id===trackId), decoded=trackId?this.options.audioSession.getDecodedTrackDescriptor(trackId):null;
        return track?.trackHash && decoded ? {contentHash:track.trackHash,durationSeconds:decoded.durationSeconds,sampleRate:decoded.sampleRate}:null;
    }
    private createProject(trackId:string) {
        const track=this.options.store.queue.find(t=>t.id===trackId),context=this.context(trackId);if(!track||!context)throw Error('歌曲身份尚未就绪。');
        return createComposition({...context,fileName:track.name,...(track.metadata.title?{title:track.metadata.title}:{}),...(track.metadata.artist?{artist:track.metadata.artist}:{})});
    }
    async enter(trackId:string|null,overwrite=false):Promise<void> {
        this.assertUnlocked();const generation=++this.generation;this.ioGeneration++;this.editorIoGeneration++;
        if(!await this.flush())throw Error('请先重试保存或导出当前工程。');
        if(generation!==this.generation||this.disposed)return;
        this.releaseLeases();
        this.publish({...initial(),state:trackId?'loading':'empty',routeTrackId:trackId});if(!trackId)return;
        try {
            const lease=await this.options.audioSession.acquireRoutePlayback({consumer:'visualizer',trackId});
            if(generation!==this.generation||this.disposed){lease.release();return;}this.playbackLease=lease;
            this.publish({...this.snapshot,activeTrackId:trackId});
            const context=this.context(trackId);if(!context)throw Error('歌曲无法解码。');
            const restored=await this.options.repository.restore();if(generation!==this.generation||this.disposed)return;
            if(!overwrite && restored?.kind==='unsupported'){this.publish({...this.snapshot,state:'unsupported-draft',unsupportedDraft:restored.raw,message:'旧版或无效草稿不能用于元素工程，请先导出或明确覆盖。'});return;}
            if(!overwrite && restored?.kind==='current' && restored.draft.project.track.contentHash!==context.contentHash){this.publish({...this.snapshot,state:'draft-conflict',conflictingDraft:restored.draft,message:'另一首歌曲已有草稿。'});return;}
            let project=!overwrite&&restored?.kind==='current'?validateComposition(restored.draft.project,context):this.createProject(trackId);
            if(!project.editorSnapshot && this.options.editorRepository){
                try {const editor=await this.options.editorRepository.restore();if(generation!==this.generation||this.disposed)return;
                    if(editor?.project.track.contentHash===context.contentHash)project=validateComposition({...project,editorSnapshot:{capturedAt:editor.savedAt,project:editor.project}},context);
                } catch { /* Optional Editor data remains explicitly disconnected. */ }
            }
            this.publish({...this.snapshot,state:'ready',project,persistence:restored?.kind==='current'&&!overwrite?'saved':'saving',restoredFromDraft:restored?.kind==='current'&&!overwrite,
                bindingRuntime:{...initial().bindingRuntime,bindingRevision:this.snapshot.bindingRuntime.bindingRevision+1,editorSnapshotSource:project.editorSnapshot?'project':'none'}});
            this.activateAnalysis();if(overwrite||!restored)this.writer.queue(project);this.syncBeforeUnload();
        }catch(error){if(generation!==this.generation||this.disposed)return;this.releaseLeases();this.publish({...initial(),state:'unavailable',routeTrackId:trackId,message:(error as Error).message});}
    }
    updateProject(input:VisualizerProjectV3){
        this.assertUnlocked();const context=this.context();if(!context||!this.snapshot.project)return;
        const project=validateComposition({...input,updatedAt:new Date().toISOString()},context);
        this.resolver.reset();this.publish({...this.snapshot,state:'ready',project,persistence:'saving',message:undefined,
            bindingRuntime:{...this.snapshot.bindingRuntime,bindingRevision:this.snapshot.bindingRuntime.bindingRevision+1,editorSnapshotSource:project.editorSnapshot?this.snapshot.bindingRuntime.editorSnapshotSource==='none'?'project':this.snapshot.bindingRuntime.editorSnapshotSource:'none'}});
        this.writer.queue(project);this.activateAnalysis();this.syncBeforeUnload();
    }
    addElement(type:ElementType){const project=this.snapshot.project;if(!project)return null;const element=elementRegistry.create(type,project.track.durationSeconds,Math.max(-1,...project.elements.map(e=>e.layer))+1);
        this.updateProject({...project,elements:[...project.elements,element]});return element.id;}
    addPreset(id:CompositionPresetId){this.assertUnlocked();const p=this.snapshot.project;if(!p)return [];
        const added=createPresetElements(id,p.track.durationSeconds,Math.max(-1,...p.elements.map(e=>e.layer))+1);
        this.updateProject({...p,elements:[...p.elements,...added]});return added.map(e=>e.id);}
    updateElement(id:string,patch:Partial<VisualizerElement>){const p=this.snapshot.project;if(p)this.updateProject({...p,elements:p.elements.map(e=>e.id===id?{...e,...structuredClone(patch),id}:e)});}
    updateBinding(id:string,binding:ElementBinding){const e=this.snapshot.project?.elements.find(e=>e.id===id);if(e)this.updateElement(id,{bindings:e.bindings.map(b=>b.parameterId===binding.parameterId?structuredClone(binding):b)});}
    removeElement(id:string){if(this.snapshot.project)this.updateProject(removeCompositionElement(this.snapshot.project,id));}
    reorderElements(ids:string[]){if(this.snapshot.project)this.updateProject(reorderComposition(this.snapshot.project,ids));}
    updateOutput(resolution:VisualizerResolution,frameRate:VisualizerFrameRate){const p=this.snapshot.project;if(p)this.updateProject({...p,output:{aspectRatio:'16:9',resolution,frameRate}});}
    resolveValuesAt(time:number):VisualizerResolvedParameterMap {
        const project=this.snapshot.project;if(!project)return new Map();
        const result=this.resolver.resolve(project,Math.max(0,time),id=>this.analysisLease?.getSeries(id)??null);
        const flat=new Map();for(const [id,values]of result)for(const [parameter,value]of values)flat.set(parameterKey(id,parameter),value);return flat;
    }
    async reloadEditorDraft(){this.assertUnlocked();const generation=this.generation,io=++this.editorIoGeneration;const draft=await this.options.editorRepository?.restore();
        if(generation!==this.generation||io!==this.editorIoGeneration||this.disposed)return;if(!draft)throw Error('没有可用的同歌 Editor 草稿。');this.setEditorSnapshot(draft.project,draft.savedAt,'draft');}
    async importEditorProject(){this.assertUnlocked();const generation=this.generation,io=++this.editorIoGeneration;const codec=new EditorFormatCodecRegistry().get('json-v1');const opened=await this.options.editorFileGateway?.open(codec);
        if(!opened||generation!==this.generation||io!==this.editorIoGeneration||this.disposed)return;const context=this.context();if(!context)return;this.setEditorSnapshot(codec.decode(opened.bytes,context),new Date().toISOString(),'imported');}
    private setEditorSnapshot(input:unknown,capturedAt:string,source:'draft'|'imported'){
        const context=this.context(),p=this.snapshot.project;if(!context||!p)return;
        const project=validateEditorProjectV1(input,context);this.updateProject({...p,editorSnapshot:{capturedAt,project}});
        this.publish({...this.snapshot,bindingRuntime:{...this.snapshot.bindingRuntime,editorSnapshotSource:source}});
    }
    removeEditorSnapshot(){const p=this.snapshot.project;if(!p)return;const next=structuredClone(p);delete next.editorSnapshot;this.updateProject(next);}
    async importProject(){this.assertUnlocked();const generation=this.generation,io=++this.ioGeneration;const opened=await this.options.fileGateway.open(compositionFileFormat);
        if(!opened||generation!==this.generation||io!==this.ioGeneration||this.disposed)return 'cancelled';const context=this.context();if(!context)return 'cancelled';
        const project=decodeComposition(opened.bytes,context);this.updateProject(project);await this.flush();return 'imported';}
    async exportProject(){const p=this.snapshot.project;if(!p)return 'cancelled';return this.options.fileGateway.save(compositionFileFormat,p.track.fileName.replace(/\.[^.]+$/,'')+compositionFileFormat.extension,encodeComposition(p));}
    async exportConflictingDraft(){
        const conflict=this.snapshot.conflictingDraft,raw=this.snapshot.unsupportedDraft;
        if(conflict)return this.options.fileGateway.save(compositionFileFormat,conflict.project.track.fileName+compositionFileFormat.extension,encodeComposition(conflict.project));
        if(raw!==null)return this.options.fileGateway.save(compositionFileFormat,'previous-visualizer-draft.json',new TextEncoder().encode(JSON.stringify(raw,null,2)+'\n'));
        return 'cancelled';
    }
    async overwriteConflictingDraft(){if(this.snapshot.activeTrackId)await this.enter(this.snapshot.activeTrackId,true);}
    retryAnalysis(){const features=this.snapshot.bindingRuntime.activeFeatureIds;return this.analysisLease?.setActiveFeatures(features);}
    private activateAnalysis(){
        const project=this.snapshot.project;if(!project||!this.options.analysisCoordinator)return;
        const ids=planCompositionFeatures(project),previous=this.snapshot.bindingRuntime.activeFeatureIds;
        const changed=ids.join('|')!==previous.join('|');
        this.publish({...this.snapshot,bindingRuntime:{...this.snapshot.bindingRuntime,activeFeatureIds:ids,readyFeatureIds:changed?[]:this.snapshot.bindingRuntime.readyFeatureIds,
            analysisState:ids.length?changed?'loading':this.snapshot.bindingRuntime.analysisState:'idle',analysisProgress:ids.length?this.snapshot.bindingRuntime.analysisProgress:0}});
        const acquired=!this.analysisLease;
        if(!this.analysisLease){this.analysisLease=this.options.analysisCoordinator.acquireConsumer('visualizer');this.unsubscribeAnalysis=this.analysisLease.subscribe(s=>this.handleAnalysis(s));}
        if(changed||acquired){const generation=this.generation,revision=this.snapshot.bindingRuntime.bindingRevision;
            void this.analysisLease.setActiveFeatures(ids).catch(error=>{if(generation===this.generation&&revision===this.snapshot.bindingRuntime.bindingRevision&&!this.disposed)
                this.publish({...this.snapshot,bindingRuntime:{...this.snapshot.bindingRuntime,analysisState:'error',analysisMessage:(error as Error).message}});});}
    }
    private handleAnalysis(s:AnalysisCoordinatorSnapshot){
        if(!this.snapshot.project||this.disposed||s.trackHash&&s.trackHash!==this.snapshot.project.track.contentHash)return;
        const r=this.snapshot.bindingRuntime,ready=s.readyFeatureIds.filter(id=>r.activeFeatureIds.includes(id));
        const state=!r.activeFeatureIds.length?'idle':s.error?'error':ready.length===r.activeFeatureIds.length&&s.state==='ready'?'ready':'loading';
        const changed=state!==r.analysisState||ready.join('|')!==r.readyFeatureIds.join('|');if(changed)this.resolver.reset();
        this.publish({...this.snapshot,bindingRuntime:{...r,bindingRevision:r.bindingRevision+(changed?1:0),readyFeatureIds:ready,analysisState:state,analysisProgress:s.progress,analysisMessage:s.error?.message}});
    }
    async flush(){const success=await this.writer.flush();this.syncBeforeUnload();return success;}
    private releaseLeases(){this.unsubscribeAnalysis?.();this.unsubscribeAnalysis=null;this.analysisLease?.release();this.analysisLease=null;this.playbackLease?.release();this.playbackLease=null;this.resolver.reset();}
    async leave(){this.generation++;this.ioGeneration++;this.editorIoGeneration++;if(this.recording.isLocked())await this.recording.cancel();await this.flush();this.releaseLeases();this.publish(initial());}
    async dispose(){await this.leave();await this.recording.dispose();this.disposed=true;this.options.repository.close();this.options.editorRepository?.close();this.windowTarget?.removeEventListener('pagehide',this.handlePageHide);this.windowTarget?.removeEventListener('beforeunload',this.handleBeforeUnload as EventListener);this.listeners.clear();}
    private readonly handlePageHide=()=>{void this.recording.handlePageHide();};
    private readonly handleBeforeUnload=(event:BeforeUnloadEvent)=>{if(this.hasPendingWrite()||this.hasUnresolvedRecordingOutput()){event.preventDefault();event.returnValue='';}};
    private syncBeforeUnload(){const needed=this.hasPendingWrite()||this.hasUnresolvedRecordingOutput();if(needed===this.beforeUnload)return;this.beforeUnload=needed;
        if(needed)this.windowTarget?.addEventListener('beforeunload',this.handleBeforeUnload as EventListener);else this.windowTarget?.removeEventListener('beforeunload',this.handleBeforeUnload as EventListener);}
}
export const visualizerSessionControllerKey:InjectionKey<VisualizerSessionController>=Symbol('visualizer-session-controller');
export const useVisualizerSessionController=()=>{const controller=inject(visualizerSessionControllerKey);if(!controller)throw Error('Visualizer controller 未提供。');return controller;};
