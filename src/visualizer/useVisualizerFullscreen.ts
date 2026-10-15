import { onMounted,onBeforeUnmount,ref,watch,type Ref } from 'vue';
export function useVisualizerFullscreen(workspace:Ref<HTMLElement|null>,playing:()=>boolean,locked:()=>boolean) {
    const active=ref(false),visible=ref(true),error=ref(''),supported=ref(false);let timer:ReturnType<typeof setTimeout>|null=null,held=false;
    const clear=()=>{if(timer)clearTimeout(timer);timer=null;};
    const schedule=()=>{clear();if(active.value&&playing()&&!held)timer=setTimeout(()=>{visible.value=false;},2000);};
    const reveal=()=>{visible.value=true;schedule();};
    const sync=()=>{active.value=document.fullscreenElement===workspace.value;visible.value=true;schedule();};
    const exit=async()=>{if(document.fullscreenElement===workspace.value){try{await document.exitFullscreen();return true;}catch(e){error.value=(e as Error).message;return false;}}return true;};
    const toggle=async()=>{error.value='';if(active.value){await exit();return;}if(locked()){error.value='录制期间不能进入全屏。';return;}if(!workspace.value?.requestFullscreen){error.value='当前浏览器不支持原生全屏。';return;}try{await workspace.value.requestFullscreen();}catch(e){error.value='进入全屏失败：'+(e as Error).message;}};
    const focusIn=()=>{held=true;clear();visible.value=true;};const focusOut=()=>{held=false;reveal();};
    const keydown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&active.value)void exit();};
    onMounted(()=>{supported.value=!!document.fullscreenEnabled;document.addEventListener('fullscreenchange',sync);document.addEventListener('keydown',keydown);});
    watch(playing,()=>{visible.value=true;schedule();});watch(locked,value=>{if(value&&active.value)void exit();});
    onBeforeUnmount(()=>{clear();document.removeEventListener('fullscreenchange',sync);document.removeEventListener('keydown',keydown);void exit();});
    return {active,visible,error,supported,toggle,exit,reveal,focusIn,focusOut};
}
