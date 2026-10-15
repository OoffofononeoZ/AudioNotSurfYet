<template>
    <div class="viz-panel-heading"><h2>属性</h2><span v-if="descriptor" class="viz-muted">{{kindLabel}}</span></div>
    <fieldset v-if="element&&descriptor" class="viz-inspector-fields app-scrollbar" :disabled="locked" :data-element-id="element.id">
        <section><label class="viz-field"><span>名称</span><input type="text" :value="element.name" aria-label="元素名称" @change="$emit('update',{name:inputValue($event)})"/></label><label class="viz-field"><span>层级</span><AppNumberInput :model-value="element.layer" label="元素层级" :disabled="locked" @change="$emit('update',{layer:$event})"/></label></section>
        <section v-if="element.targets"><h3>影响对象</h3><label class="viz-field"><span>目标</span><AppSelect :model-value="element.targets.kind" label="影响对象范围" :disabled="locked" :options="targetOptions" @change="targetKindChanged"/></label><div v-if="element.targets.kind==='elements'" class="viz-targets"><label v-for="target in visualElements" :key="target.id" class="viz-field"><span>{{target.name}}</span><input type="checkbox" :checked="element.targets.ids.includes(target.id)" @change="targetChanged(target.id,$event)"/></label><p v-if="!visualElements.length" class="viz-muted">先添加视觉元素</p></div></section>
        <section><h3>{{descriptor.kind==='transition'?'转场输入':'时间范围'}}</h3>
            <template v-if="descriptor.kind==='transition'"><label class="viz-field stacked"><span>范围标记</span><AppSelect :model-value="markerValue" label="转场范围标记" :options="markerOptions" :disabled="locked" @change="markerChanged"/></label><div v-if="range" class="viz-time-summary"><span>起始 {{range.startSeconds.toFixed(3)}} s</span><span>终止 {{range.endSeconds.toFixed(3)}} s</span></div><p v-else class="viz-muted">从底栏载入同歌 Editor 数据</p></template>
            <template v-else-if="element.timing.kind==='manual'"><label class="viz-field"><span>起始（秒）</span><AppNumberInput :model-value="element.timing.startSeconds" :min="0" :step=".001" :max="project.track.durationSeconds" label="元素起始时间" :disabled="locked" @change="timeChanged('startSeconds',$event)"/></label><label class="viz-field"><span>终止（秒）</span><AppNumberInput :model-value="element.timing.endSeconds" :min="0" :step=".001" :max="project.track.durationSeconds" label="元素终止时间" :disabled="locked" @change="timeChanged('endSeconds',$event)"/></label></template>
        </section>
        <section><h3>{{descriptor.inputParameter?'输入与视觉参数':'视觉参数'}}</h3><VisualizerParameterField v-for="parameter in descriptor.parameters" :key="element.id+':'+parameter.id" :parameter="parameter" :binding="element.bindings.find(b=>b.parameterId===parameter.id)!" :project="project" :element-id="element.id" :disabled="locked" @change="$emit('binding',$event)"/></section>
    </fieldset>
    <div v-else class="viz-inspector-empty"><VisualizerIcon name="sliders"/><span>选择一个元素</span></div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import AppSelect from '../controls/AppSelect.vue';
import AppNumberInput from '../controls/AppNumberInput.vue';
import VisualizerIcon from './VisualizerIcon.vue';import VisualizerParameterField from './VisualizerParameterField.vue';
import { elementRegistry } from '../../visualizer/elementRegistry';import { elementRange } from '../../visualizer/compositionModel';
import type { ElementBinding,VisualizerElement,VisualizerProjectV3 } from '../../visualizer/compositionTypes';
const props=defineProps<{project:VisualizerProjectV3;element:VisualizerElement|null;locked:boolean}>();
const emit=defineEmits<{update:[patch:Partial<VisualizerElement>];binding:[binding:ElementBinding]}>();
const descriptor=computed(()=>props.element?elementRegistry.get(props.element.type):null);
const kindLabel=computed(()=>({visual:'视觉元素',modifier:'影响效果',transition:'转场'})[descriptor.value?.kind??'visual']);
const range=computed(()=>props.element?elementRange(props.project,props.element):null);
const visualElements=computed(()=>props.project.elements.filter(e=>elementRegistry.get(e.type).kind==='visual'));
const rangeLanes=computed(()=>props.project.editorSnapshot?.project.lanes.filter(l=>l.eventKind==='range')??[]);
const markerValue=computed(()=>props.element?.timing.kind==='editor-range'?props.element.timing.laneId+':'+props.element.timing.eventId:'');
const targetOptions=[{value:'composition',label:'整个画面'},{value:'elements',label:'指定元素'}];
const markerOptions=computed(()=>[{value:'',label:'选择一个范围标记'},...rangeLanes.value.flatMap(lane=>lane.events.map(event=>({value:lane.id+':'+event.id,label:lane.name+' · '+(lane.innerClasses.find(c=>c.id===event.innerClassId)?.label??'')+' · '+event.startSeconds.toFixed(2)+'–'+event.endSeconds.toFixed(2)+' s'})))]);
const inputValue=(event:Event)=>(event.target as HTMLInputElement).value;
function timeChanged(key:'startSeconds'|'endSeconds',value:number){if(props.element?.timing.kind==='manual')emit('update',{timing:{...props.element.timing,[key]:value}});}
function markerChanged(value:string|number){const [laneId,eventId]=String(value).split(':');emit('update',{timing:laneId&&eventId?{kind:'editor-range',laneId,eventId}:{kind:'unbound'}});}
function targetKindChanged(value:string|number){emit('update',{targets:value==='composition'?{kind:'composition'}:{kind:'elements',ids:[]}});}
function targetChanged(id:string,event:Event){if(props.element?.targets?.kind!=='elements')return;const checked=(event.target as HTMLInputElement).checked;emit('update',{targets:{kind:'elements',ids:checked?[...props.element.targets.ids,id]:props.element.targets.ids.filter(item=>item!==id)}});}
</script>
