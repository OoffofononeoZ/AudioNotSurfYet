<template>
    <div class="viz-panel-heading"><h2>属性</h2><span v-if="descriptor" class="viz-muted">{{kindLabel}}</span></div>
    <fieldset v-if="element&&descriptor" class="viz-inspector-fields app-scrollbar" :disabled="locked" :data-element-id="element.id">
        <section><label class="viz-field"><span>名称</span><input type="text" :value="element.name" aria-label="元素名称" @change="$emit('update',{name:inputValue($event)})"/></label><label class="viz-field"><span>层级</span><input type="number" step="1" :value="element.layer" aria-label="元素层级" @change="$emit('update',{layer:Number(inputValue($event))})"/></label></section>
        <section v-if="element.targets"><h3>影响对象</h3><label class="viz-field"><span>目标</span><select :value="element.targets.kind" aria-label="影响对象范围" @change="targetKindChanged"><option value="composition">整个画面</option><option value="elements">指定元素</option></select></label><div v-if="element.targets.kind==='elements'" class="viz-targets"><label v-for="target in visualElements" :key="target.id" class="viz-field"><span>{{target.name}}</span><input type="checkbox" :checked="element.targets.ids.includes(target.id)" @change="targetChanged(target.id,$event)"/></label><p v-if="!visualElements.length" class="viz-muted">先添加视觉元素</p></div></section>
        <section><h3>{{descriptor.kind==='transition'?'转场输入':'时间范围'}}</h3>
            <template v-if="descriptor.kind==='transition'"><label class="viz-field stacked"><span>范围标记</span><select :value="markerValue" aria-label="转场范围标记" @change="markerChanged"><option value="">选择一个范围标记</option><optgroup v-for="lane in rangeLanes" :key="lane.id" :label="lane.name"><option v-for="event in lane.events" :key="event.id" :value="lane.id+':'+event.id">{{lane.innerClasses.find(c=>c.id===event.innerClassId)?.label}} · {{event.startSeconds.toFixed(2)}}–{{event.endSeconds.toFixed(2)}} s</option></optgroup></select></label><div v-if="range" class="viz-time-summary"><span>起始 {{range.startSeconds.toFixed(3)}} s</span><span>终止 {{range.endSeconds.toFixed(3)}} s</span></div><p v-else class="viz-muted">从底栏载入同歌 Editor 数据</p></template>
            <template v-else-if="element.timing.kind==='manual'"><label class="viz-field"><span>起始（秒）</span><input type="number" min="0" step=".001" :max="project.track.durationSeconds" :value="element.timing.startSeconds" aria-label="元素起始时间" @change="timeChanged('startSeconds',$event)"/></label><label class="viz-field"><span>终止（秒）</span><input type="number" min="0" step=".001" :max="project.track.durationSeconds" :value="element.timing.endSeconds" aria-label="元素终止时间" @change="timeChanged('endSeconds',$event)"/></label></template>
        </section>
        <section><h3>{{descriptor.inputParameter?'输入与视觉参数':'视觉参数'}}</h3><VisualizerParameterField v-for="parameter in descriptor.parameters" :key="element.id+':'+parameter.id" :parameter="parameter" :binding="element.bindings.find(b=>b.parameterId===parameter.id)!" :project="project" :element-id="element.id" @change="$emit('binding',$event)"/></section>
    </fieldset>
    <div v-else class="viz-inspector-empty"><VisualizerIcon name="sliders"/><span>选择一个元素</span></div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
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
const inputValue=(event:Event)=>(event.target as HTMLInputElement).value;
function timeChanged(key:'startSeconds'|'endSeconds',event:Event){if(props.element?.timing.kind==='manual')emit('update',{timing:{...props.element.timing,[key]:Number(inputValue(event))}});}
function markerChanged(event:Event){const [laneId,eventId]=inputValue(event).split(':');emit('update',{timing:laneId&&eventId?{kind:'editor-range',laneId,eventId}:{kind:'unbound'}});}
function targetKindChanged(event:Event){emit('update',{targets:inputValue(event)==='composition'?{kind:'composition'}:{kind:'elements',ids:[]}});}
function targetChanged(id:string,event:Event){if(props.element?.targets?.kind!=='elements')return;const checked=(event.target as HTMLInputElement).checked;emit('update',{targets:{kind:'elements',ids:checked?[...props.element.targets.ids,id]:props.element.targets.ids.filter(item=>item!==id)}});}
</script>
