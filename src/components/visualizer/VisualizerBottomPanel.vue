<template>
    <section class="viz-bottom" :class="{collapsed}" aria-label="工程底栏">
        <div class="viz-bottom-tabs"><div role="tablist" aria-label="工程面板"><button v-for="item in tabs" :key="item.id" type="button" role="tab" :aria-selected="tab===item.id&&!collapsed" :aria-controls="'viz-bottom-'+item.id" @click="tab=item.id;collapsed=false">{{item.label}}</button></div><span class="viz-save-state" :data-state="snapshot.persistence" aria-live="polite">{{persistenceLabel}}</span><button type="button" class="viz-icon-button small" :aria-label="collapsed?'展开工程底栏':'折叠工程底栏'" :aria-expanded="!collapsed" @click="collapsed=!collapsed"><VisualizerIcon :name="collapsed?'up':'down'"/></button></div>
        <div v-show="!collapsed" :id="'viz-bottom-'+tab" class="viz-bottom-content app-scrollbar" role="tabpanel">
            <fieldset v-if="tab==='output'" class="viz-output-grid" :disabled="locked">
                <label class="viz-field"><span>分辨率</span><AppSelect :model-value="project.output.resolution" label="输出分辨率" :options="resolutions" :disabled="locked" @change="setResolution"/></label>
                <label class="viz-field"><span>帧率</span><AppSelect :model-value="project.output.frameRate" label="输出帧率" :options="frameRates" :disabled="locked" @change="setFrameRate"/></label>
                <label class="viz-field"><span>Seed</span><AppNumberInput :model-value="project.seed" :min="0" :max="4294967295" label="确定性 Seed" :disabled="locked" @change="$emit('seed',$event)"/></label>
            </fieldset>
            <div v-else-if="tab==='editor'" class="viz-bottom-editor"><span>{{project.editorSnapshot?'已载入同歌快照 · '+rangeCount+' 个范围标记':'未载入 Editor 数据'}}</span><div class="viz-inline-actions"><button type="button" :disabled="locked" @click="$emit('reload-editor')">重新载入草稿</button><button type="button" :disabled="locked" @click="$emit('import-editor')">导入 Editor JSON</button><button type="button" :disabled="locked||!project.editorSnapshot||editorInUse" @click="$emit('remove-editor')">移除</button></div></div>
            <div v-else class="viz-status-lines" aria-live="polite"><div><span>分析</span><span>{{analysisLabel}} · {{Math.round(snapshot.bindingRuntime.analysisProgress*100)}}% · {{snapshot.bindingRuntime.activeFeatureIds.length}}/4</span><button v-if="snapshot.bindingRuntime.analysisState==='error'" type="button" :disabled="locked" @click="$emit('retry-analysis')">重试</button></div><progress v-if="snapshot.bindingRuntime.analysisState==='loading'" max="1" :value="snapshot.bindingRuntime.analysisProgress"/><p v-if="snapshot.bindingRuntime.analysisMessage" class="viz-error">{{snapshot.bindingRuntime.analysisMessage}}</p><p v-for="issue in issues" :key="issue" class="viz-error">{{issue}}</p><div :data-export-status="snapshot.export.status"><span>{{exportLabel}}</span><div class="viz-inline-actions"><template v-if="snapshot.export.status==='ready'"><button type="button" data-testid="save-visualizer-export" @click="$emit('save-export')">保存 WebM</button><button type="button" data-testid="discard-visualizer-export" @click="$emit('discard-export')">丢弃</button></template><button v-if="snapshot.export.status==='error'" type="button" @click="$emit('reset-export')">清除错误</button></div></div><p v-if="snapshot.export.status==='error'" class="viz-error">{{snapshot.export.message}}</p></div>
            <progress v-if="snapshot.export.status==='exporting'" aria-label="视频导出进度" :max="snapshot.export.totalFrames" :value="snapshot.export.framesDone"/>
            <span v-if="snapshot.export.status==='exporting'">{{snapshot.export.framesDone}} / {{snapshot.export.totalFrames}} 帧</span>
            <p v-if="tab==='output'&&!outputAvailability" class="viz-muted" role="status">正在检查离线导出能力…</p>
            <p v-else-if="tab==='output'&&outputAvailability&&!outputAvailability.available" class="viz-error" role="status">{{outputAvailability.reason}}</p>
            <p v-if="error||snapshot.message" class="viz-error" role="alert">{{error||snapshot.message}}</p><button v-if="snapshot.persistence==='not-persisted'" type="button" @click="$emit('retry-save')">重试保存</button>
        </div>
    </section>
</template>
<script setup lang="ts">
import { computed,ref,watch } from 'vue';import VisualizerIcon from './VisualizerIcon.vue';
import AppSelect from '../controls/AppSelect.vue';
import AppNumberInput from '../controls/AppNumberInput.vue';
import { compositionIssues } from '../../visualizer/compositionModel';
import { useExportCapabilities } from '../../visualizer/useExportCapabilities';
import type { CompositionSessionSnapshot,VisualizerProjectV3 } from '../../visualizer/compositionTypes';
import type { VisualizerResolution,VisualizerFrameRate } from '../../visualizer/types';
const props=defineProps<{snapshot:CompositionSessionSnapshot;project:VisualizerProjectV3;locked:boolean;error:string}>();
const emit=defineEmits<{output:[resolution:VisualizerResolution,frameRate:VisualizerFrameRate];seed:[seed:number];'reload-editor':[];'import-editor':[];'remove-editor':[];'retry-analysis':[];'save-export':[];'discard-export':[];'reset-export':[];'retry-save':[]}>();
const tab=ref('output'),collapsed=ref(false),tabs=[{id:'output',label:'输出'},{id:'editor',label:'Editor 数据'},{id:'status',label:'状态'}];
const persistenceLabel=computed(()=>({clean:'',saving:'保存中',saved:'已保存','not-persisted':'未保存'})[props.snapshot.persistence]);
const analysisLabel=computed(()=>({idle:'未使用',loading:'分析中',ready:'已就绪',error:'失败'})[props.snapshot.bindingRuntime.analysisState]);
const exportLabel=computed(()=>({idle:'导出待命',preparing:'正在准备导出',exporting:'正在导出视频',finalizing:'正在生成 WebM',ready:'WebM 已就绪',error:'导出失败'})[props.snapshot.export.status]);
const issues=computed(()=>compositionIssues(props.project));
const rangeCount=computed(()=>props.project.editorSnapshot?.project.lanes.reduce((n,l)=>n+(l.eventKind==='range'?l.events.length:0),0)??0);
const editorInUse=computed(()=>props.project.elements.some(e=>e.timing.kind==='editor-range'));
watch(()=>[props.error,props.snapshot.export.status,props.snapshot.persistence],()=>{if(props.error||props.snapshot.export.status!=='idle'||props.snapshot.persistence==='not-persisted'){tab.value='status';collapsed.value=false;}});
const capability=useExportCapabilities();
const outputAvailability=computed(()=>capability(props.project.output.resolution,props.project.output.frameRate));
const resolutions=computed(()=>(['720p','1080p'] as const).map(value=>{
    const rates=availableFrameRates(value),disabled=!rates.length;
    const label=value==='720p'?'1280 × 720':'1920 × 1080';
    return {value,label:label+(disabled?'（暂不可用）':''),disabled};
}));
const frameRates=computed(()=>([30,60] as const).map(value=>{
    const disabled=!capability(props.project.output.resolution,value)?.available;
    return {value,label:value+' fps'+(disabled?'（暂不可用）':''),disabled};
}));
function availableFrameRates(resolution:VisualizerResolution){return ([30,60] as const).filter(fps=>capability(resolution,fps)?.available);}
function setResolution(value:string|number){emit('output',value as VisualizerResolution,props.project.output.frameRate);}
function setFrameRate(value:string|number){emit('output',props.project.output.resolution,Number(value) as VisualizerFrameRate);}
</script>
