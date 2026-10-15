import { onBeforeUnmount,watch,ref,type Ref } from 'vue';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type { VisualizerSessionController } from './visualizerSessionController';
import { VisualizerRendererHost } from './visualizerRendererHost';
import { CompositionScene,type CompositionRenderPort } from './compositionScene';
import type { CompositionSessionSnapshot } from './compositionTypes';
import type { VisualizerRendererStatus } from './rendererTypes';
export function useVisualizerPreview(canvas:Ref<HTMLCanvasElement|null>,controller:VisualizerSessionController,store:ReturnType<typeof useAudioSessionStore>,snapshot:Ref<CompositionSessionSnapshot>) {
    const status=ref<VisualizerRendererStatus>({state:'idle'});let host:VisualizerRendererHost|null=null,observer:ResizeObserver|null=null,detach:(()=>void)|null=null;
    const cleanup=()=>{observer?.disconnect();observer=null;detach?.();detach=null;host?.dispose();host=null;};
    watch(canvas,element=>{
        cleanup();if(!element)return;
        try {
            host=new VisualizerRendererHost({canvas:element,
                createScene:surface=>new CompositionScene({renderer:surface.renderer as CompositionRenderPort,readProject:()=>controller.readProject(),resolveAt:t=>controller.resolveValuesAt(t)}),
                readFrame:()=>{const p=controller.readProject();return p?{trackIdentity:p.track.contentHash,seed:p.seed,timeSeconds:store.playback.currentTimeSeconds,bindingRevision:snapshot.value.bindingRuntime.bindingRevision,playbackState:store.playback.state}:null;},
                resolveValuesAt:t=>controller.resolveValuesAt(t),onFrame(){},onStatus:value=>{status.value=value;controller.notifyRendererStatus(value);}});
            const target=host;detach=controller.attachRecordingTarget({getStatus:()=>status.value,acquireRecordingSurface:(w,h)=>target.acquireRecordingSurface(w,h)});
            observer=new ResizeObserver(()=>{const rect=element.getBoundingClientRect();target.resize(rect.width,rect.height);});observer.observe(element);
            const rect=element.getBoundingClientRect();target.resize(rect.width,rect.height);
        }catch(error){cleanup();status.value={state:'error',message:(error as Error).message};}
    },{flush:'post'});
    watch(()=>[snapshot.value.bindingRuntime.bindingRevision,snapshot.value.project?.seed,store.playback.state,store.playback.currentTimeSeconds],()=>host?.requestFrame());
    onBeforeUnmount(cleanup);
    return {status,retry:()=>host?.retry()};
}
