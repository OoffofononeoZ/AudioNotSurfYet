<template>
    <main class="visualizer-page" data-testid="visualizer-page">
        <header class="viz-toolbar" aria-label="工程操作"><button type="button" class="viz-icon-button" :disabled="!usable||locked" aria-label="导入工程" title="导入工程" data-testid="import-visualizer-project" @click="run(()=>controller.importProject())"><VisualizerIcon name="import"/></button><button type="button" class="viz-icon-button" :disabled="!usable" aria-label="导出工程" title="导出工程" data-testid="export-visualizer-project" @click="run(()=>controller.exportProject())"><VisualizerIcon name="export"/></button><div v-if="usable" class="viz-drawer-controls"><button type="button" class="viz-icon-button" :aria-expanded="drawer==='elements'" aria-label="元素列表" @click="drawer=drawer==='elements'?null:'elements'"><VisualizerIcon name="layers"/></button><button type="button" class="viz-icon-button" :aria-expanded="drawer==='inspector'" aria-label="元素属性" @click="drawer=drawer==='inspector'?null:'inspector'"><VisualizerIcon name="sliders"/></button></div></header>
        <section v-if="snapshot.project&&usable" ref="workspace" class="viz-workspace" data-testid="visualizer-ready" :class="{'is-fullscreen':fullscreen.active.value}" @pointermove="fullscreen.reveal" @keydown.capture="fullscreen.reveal">
            <aside class="viz-panel viz-elements" :class="{'drawer-open':drawer==='elements'}" aria-label="元素列表" data-testid="visualizer-elements-panel"><button type="button" class="viz-drawer-close viz-icon-button" aria-label="关闭元素列表" @click="drawer=null"><VisualizerIcon name="close"/></button><VisualizerElementList :items="snapshot.project.elements" :selection="selection" :locked="locked" @add="catalogOpen=true" @select="selectElement" @visibility="(id,enabled)=>run(()=>controller.updateElement(id,{enabled}))" @remove="id=>run(()=>controller.removeElement(id))" @reorder="ids=>run(()=>controller.reorderElements(ids))"/></aside>
            <section class="viz-preview-column" aria-label="可视化预览">
                <div class="viz-preview-stage"><div class="viz-preview-frame" data-testid="visualizer-preview-frame" :data-scene-status="preview.status.value.state"><canvas ref="canvas" data-testid="visualizer-preview-canvas"/>
                    <div v-if="preview.status.value.state==='error'" class="viz-preview-error" role="alert"><span>{{preview.status.value.message}}</span><button type="button" @click="preview.retry">重试渲染</button></div><div v-else-if="preview.status.value.state==='recovering'" class="viz-preview-notice" role="status">正在恢复画面</div>
                    <div v-if="locked" class="viz-recording-badge" aria-live="polite"><i/>{{recordingLabel}}</div>
                    <div class="viz-video-controls" :class="{'controls-visible':fullscreen.visible.value&&fullscreen.active.value}" @focusin="fullscreen.focusIn" @focusout="fullscreen.focusOut" @pointerenter="fullscreen.focusIn" @pointerleave="fullscreen.focusOut">
                        <template v-if="fullscreen.active.value"><input class="viz-fullscreen-progress" type="range" min="0" :max="store.playback.durationSeconds" step=".001" :value="store.playback.currentTimeSeconds" aria-label="全屏播放进度" data-testid="visualizer-seek" :disabled="locked" @input="run(()=>controller.seek(Number(($event.target as HTMLInputElement).value)))"/><button type="button" class="viz-icon-button" :aria-label="store.playback.state==='playing'?'暂停':'播放'" :disabled="locked" @click="run(()=>controller.togglePlayback())"><VisualizerIcon :name="store.playback.state==='playing'?'pause':'play'"/></button><span class="viz-fullscreen-time">{{formatTime(store.playback.currentTimeSeconds)}} / {{formatTime(store.playback.durationSeconds)}}</span></template>
                        <span class="viz-controls-spacer"/>
                        <button v-if="snapshot.recording.status==='idle'" type="button" class="viz-icon-button" aria-label="开始录制" title="开始录制" data-testid="start-visualizer-recording" @click="startRecording"><VisualizerIcon name="record"/></button><button v-if="locked" type="button" class="viz-icon-button recording" aria-label="取消录制" title="取消录制" data-testid="cancel-visualizer-recording" @click="run(()=>controller.cancelRecording())"><VisualizerIcon name="stop"/></button>
                        <button type="button" class="viz-icon-button" :disabled="!fullscreen.supported.value||locked&&!fullscreen.active.value" :aria-label="fullscreen.active.value?'退出全屏播放':'进入全屏播放'" :title="fullscreen.active.value?'退出全屏':'全屏'" data-testid="visualizer-fullscreen-toggle" @click="fullscreen.toggle"><VisualizerIcon :name="fullscreen.active.value?'exit':'fullscreen'"/></button>
                    </div>
                </div></div>
                <VisualizerBottomPanel :snapshot="snapshot" :project="snapshot.project" :locked="locked" :error="actionError||fullscreen.error.value" @output="(r,f)=>run(()=>controller.updateOutput(r,f))" @seed="seed=>run(()=>controller.updateProject({...snapshot.project!,seed}))" @reload-editor="run(()=>controller.reloadEditorDraft())" @import-editor="run(()=>controller.importEditorProject())" @remove-editor="run(()=>controller.removeEditorSnapshot())" @retry-analysis="run(()=>controller.retryAnalysis())" @save-recording="run(()=>controller.saveRecording())" @discard-recording="run(()=>controller.discardRecording())" @reset-recording="run(()=>controller.resetRecordingError())" @retry-save="run(()=>controller.flush())"/>
            </section>
            <aside class="viz-panel viz-properties" :class="{'drawer-open':drawer==='inspector'}" aria-label="元素属性" data-testid="visualizer-settings-panel"><button type="button" class="viz-drawer-close viz-icon-button" aria-label="关闭元素属性" @click="drawer=null"><VisualizerIcon name="close"/></button><VisualizerElementInspector :project="snapshot.project" :element="selectedElement" :locked="locked" @update="patch=>run(()=>{if(selection)controller.updateElement(selection,patch);})" @binding="binding=>run(()=>{if(selection)controller.updateBinding(selection,binding);})"/></aside>
        </section>
        <section v-else class="viz-page-state app-scrollbar" :data-testid="'visualizer-'+snapshot.state">
            <template v-if="snapshot.state==='draft-conflict'||snapshot.state==='unsupported-draft'"><h1>{{snapshot.state==='unsupported-draft'?'草稿版本不兼容':'另一首歌曲已有草稿'}}</h1><p>{{snapshot.message}}</p><div class="viz-inline-actions"><button type="button" @click="run(()=>controller.exportConflictingDraft())">导出原草稿</button><button type="button" @click="run(()=>controller.overwriteConflictingDraft())">覆盖草稿</button><button type="button" @click="router.push('/')">取消进入</button></div></template>
            <template v-else-if="snapshot.state==='empty'"><h1>先选择一首歌曲</h1><p>使用底部播放器导入或选择歌曲。</p></template><template v-else-if="snapshot.state==='loading'"><p role="status">正在准备工程…</p></template><template v-else><h1>歌曲暂时不可用</h1><p role="alert">{{snapshot.message}}</p></template><p v-if="actionError" class="viz-error" role="alert">{{actionError}}</p>
        </section>
        <VisualizerElementCatalog :open="catalogOpen" @close="catalogOpen=false" @add="addElement"/>
        <dialog ref="leaveDialog" class="viz-leave-dialog" aria-labelledby="viz-leave-title" @cancel.prevent="resolveLeave(false)"><h2 id="viz-leave-title">{{leaveKind==='project'?'切换歌曲工程':locked?'录制尚未结束':'WebM 尚未处理'}}</h2><p>{{leaveKind==='project'?'当前只保留一个可视化草稿。可以先导出当前工程，或明确覆盖为目标歌曲的空工程。':locked?'离开会取消当前录制，不生成半文件。':'请先保存或明确丢弃当前 WebM。'}}</p><div class="viz-inline-actions"><template v-if="leaveKind==='project'"><button type="button" @click="run(()=>controller.exportProject())">导出当前工程</button><button type="button" data-testid="confirm-track-project-switch" @click="resolveLeave(true)">覆盖草稿并切换</button></template><button v-else-if="locked" type="button" @click="cancelAndLeave">取消录制并离开</button><template v-else><button type="button" @click="saveAndLeave">保存并离开</button><button type="button" @click="discardAndLeave">丢弃并离开</button></template><button type="button" @click="resolveLeave(false)">留在此页</button></div></dialog>
    </main>
</template>
<script setup lang="ts">
import { computed,onBeforeUnmount,ref,shallowRef,watch } from 'vue';import { onBeforeRouteLeave,onBeforeRouteUpdate,useRoute,useRouter } from 'vue-router';
import VisualizerIcon from '../components/visualizer/VisualizerIcon.vue';import VisualizerElementList from '../components/visualizer/VisualizerElementList.vue';import VisualizerElementCatalog from '../components/visualizer/VisualizerElementCatalog.vue';import VisualizerElementInspector from '../components/visualizer/VisualizerElementInspector.vue';import VisualizerBottomPanel from '../components/visualizer/VisualizerBottomPanel.vue';
import { useAudioSessionService } from '../audio/audioSessionService';
import { useAudioSessionStore } from '../stores/audioSessionStore';import { useVisualizerSessionController } from '../visualizer/visualizerSessionController';import { useVisualizerPreview } from '../visualizer/useVisualizerPreview';import { useVisualizerFullscreen } from '../visualizer/useVisualizerFullscreen';import type { ElementType } from '../visualizer/compositionTypes';import { formatSecToTime as formatTime } from '../utils/utils';import '../visualizer/workspace.css';
const route=useRoute(),router=useRouter(),controller=useVisualizerSessionController(),store=useAudioSessionStore(),audioSession=useAudioSessionService();
const snapshot=shallowRef(controller.getSnapshot()),unsubscribe=controller.subscribe(value=>snapshot.value=value);
const workspace=ref<HTMLElement|null>(null),canvas=ref<HTMLCanvasElement|null>(null),catalogOpen=ref(false),selection=ref<string|null>(null),drawer=ref<'elements'|'inspector'|null>(null),actionError=ref('');
const locked=computed(()=>['preparing','recording','finalizing'].includes(snapshot.value.recording.status));
const usable=computed(()=>['ready','not-persisted'].includes(snapshot.value.state));
const selectedElement=computed(()=>snapshot.value.project?.elements.find(e=>e.id===selection.value)??null);
const preview=useVisualizerPreview(canvas,controller,store,snapshot),fullscreen=useVisualizerFullscreen(workspace,()=>store.playback.state==='playing',()=>locked.value);
const recordingLabel=computed(()=>({preparing:'准备录制',recording:'正在录制',finalizing:'正在生成 WebM'} as Record<string,string>)[snapshot.value.recording.status]??'');
async function run(operation:()=>unknown){actionError.value='';try{return await operation();}catch(error){actionError.value=(error as Error).message;return null;}}
function selectElement(id:string){selection.value=id;drawer.value=drawer.value==='elements'?'inspector':drawer.value;}
async function addElement(type:ElementType){const id=await run(()=>controller.addElement(type));if(typeof id==='string'){selection.value=id;catalogOpen.value=false;drawer.value=null;}}
async function startRecording(){if(!await fullscreen.exit())return;await run(()=>controller.startRecording());}
let requestedPlayTarget:string|null=null,entryRevision=0;
let approval:{trackId:string;project:ReturnType<typeof controller.readProject>}|null=null;
watch(()=>route.params.trackId,trackId=>{
    if(route.name!=='visualizer')return;
    selection.value=null;drawer.value=null;catalogOpen.value=false;
    const id=typeof trackId==='string'?trackId:store.currentTrackId,revision=++entryRevision;
    const overwrite=!!id&&approval?.trackId===id&&approval.project===controller.readProject();approval=null;
    void run(async()=>{await controller.enter(id,overwrite);if(revision!==entryRevision)return;
        if(id&&requestedPlayTarget===id&&controller.getSnapshot().state==='ready'){requestedPlayTarget=null;await audioSession.play();}});
},{immediate:true});
watch(()=>snapshot.value.project?.elements.map(e=>e.id).join('|'),()=>{if(selection.value&&!selectedElement.value)selection.value=null;});
const leaveDialog=ref<HTMLDialogElement|null>(null),leaveKind=ref<'recording'|'project'>('recording');let pendingLeave:((value:boolean)=>void)|null=null;
function resolveLeave(value:boolean){leaveDialog.value?.close();const resolve=pendingLeave;pendingLeave=null;resolve?.(value);}
async function cancelAndLeave(){await controller.cancelRecording();resolveLeave(true);}
async function saveAndLeave(){const result=await run(()=>controller.saveRecording());if(result==='saved')resolveLeave(true);}
function discardAndLeave(){controller.discardRecording();resolveLeave(true);}
async function guardLeave(){if(!await fullscreen.exit())return false;if(controller.hasUnresolvedRecordingOutput()){resolveLeave(false);leaveKind.value='recording';const answer=await new Promise<boolean>(resolve=>{pendingLeave=resolve;leaveDialog.value?.showModal();});if(!answer)return false;}if(!await controller.flush()){actionError.value='当前工程尚未保存，请重试保存或导出。';return false;}return true;}
async function prepareTrackChange(id:string|null){
    if(!await guardLeave())return false;
    const project=controller.readProject(),track=id?store.queue.find(t=>t.id===id):null;
    if(!id||!project||track?.trackHash===project.track.contentHash)return true;
    if(approval?.trackId===id&&approval.project===project)return true;
    resolveLeave(false);leaveKind.value='project';
    const confirmed=await new Promise<boolean>(resolve=>{pendingLeave=resolve;leaveDialog.value?.showModal();});
    if(confirmed)approval={trackId:id,project:controller.readProject()};
    return confirmed;
}
const detachNavigation=audioSession.attachTrackNavigation({
    async select(id){requestedPlayTarget=id;const result=await router.push({name:'visualizer',params:{trackId:id}});if(result&&requestedPlayTarget===id)requestedPlayTarget=null;},
    beforeMutation:prepareTrackChange,
    async cleared(){requestedPlayTarget=null;await router.push({name:'visualizer',params:{trackId:undefined}});},
});
onBeforeRouteLeave(async()=>{if(!await guardLeave())return false;await controller.leave();return true;});
onBeforeRouteUpdate(async to=>prepareTrackChange(typeof to.params.trackId==='string'?to.params.trackId:null));
onBeforeUnmount(()=>{entryRevision++;detachNavigation();resolveLeave(false);unsubscribe();});
</script>
