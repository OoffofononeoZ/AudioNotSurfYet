<template>
    <div class="viz-parameter" :data-parameter-id="parameter.id">
        <label v-if="dynamic" class="viz-field"><span>{{parameter.label}}</span><select :value="binding.source.kind" :aria-label="parameter.label+'数据来源'" @change="sourceChanged"><option value="constant">固定值</option><option value="analysis">Analyzer</option><option disabled value="stem-analysis">分轨 Analyzer（未接入）</option><option v-if="binding.source.kind==='unbound'" value="unbound">未配置</option></select></label>
        <label v-if="binding.source.kind==='constant'" class="viz-field"><span>{{dynamic?'固定值':parameter.label}}</span>
            <input v-if="parameter.valueKind==='number'" type="number" :min="parameter.range?.min" :max="parameter.range?.max" :step="parameter.range?.integer?1:.001" :value="binding.source.value" :aria-label="parameter.label" @change="constantChanged"/>
            <input v-else-if="parameter.valueKind==='color'" type="color" :value="binding.source.value" :aria-label="parameter.label" @input="constantChanged"/>
            <input v-else-if="parameter.valueKind==='boolean'" type="checkbox" :checked="binding.source.value===true" :aria-label="parameter.label" @change="constantChanged"/>
            <span v-else class="viz-muted">静态</span>
        </label>
        <template v-if="analysis">
            <label class="viz-field"><span>特征</span><select :value="analysis.featureId" :aria-label="parameter.label+'分析特征'" @change="featureChanged"><option v-for="id in features" :key="id" :value="id" :disabled="featureDisabled(id)">{{FEATURE_REGISTRY[id].label}}</option></select></label>
            <label v-if="components.length>1" class="viz-field"><span>分量</span><select :value="analysis.component??'default'" @change="componentChanged"><option v-for="component in components" :key="component" :value="component">{{component}}</option></select></label>
            <label v-if="projections.length>1" class="viz-field"><span>投影</span><select :value="analysis.projection.kind" @change="projectionChanged"><option v-for="kind in projections" :key="kind" :value="kind">{{projectionLabels[kind]}}</option></select></label>
            <label v-if="analysis.projection.kind==='bin'" class="viz-field"><span>Bin</span><input type="number" min="0" :max="vectorLength-1" :value="analysis.projection.index" @change="projectionNumber('index',$event)"/></label>
            <template v-if="analysis.projection.kind==='band'"><label v-for="key in ['start','end'] as const" :key="key" class="viz-field"><span>{{key==='start'?'频段起点':'频段终点'}}</span><input type="number" :min="key==='start'?0:1" :max="vectorLength" :value="analysis.projection[key]" @change="projectionNumber(key,$event)"/></label></template>
            <details v-if="parameter.valueKind==='number'" class="viz-mapping"><summary>数值映射</summary><label v-for="field in transformFields" :key="field.key" class="viz-field"><span>{{field.label}}</span><input type="number" step="any" :value="transform[field.key]" @change="transformChanged(field.key,$event)"/></label><label class="viz-field"><span>限制范围</span><input type="checkbox" :checked="transform.clamp" @change="transformFlag('clamp',$event)"/></label><label class="viz-field"><span>反转</span><input type="checkbox" :checked="transform.invert" @change="transformFlag('invert',$event)"/></label></details>
        </template>
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { FEATURE_REGISTRY } from '../../analysis/featureRegistry';
import type { FeatureId } from '../../analysis/types';
import type { SceneParameterDescriptor } from '../../visualizer/parameterDescriptor';
import type { ElementBinding,VisualizerProjectV3 } from '../../visualizer/compositionTypes';
import type { VisualizerAnalysisComponent,VisualizerAnalysisProjectionV1,VisualizerNumericTransformV1 } from '../../visualizer/types';
import { analysisComponentsForFeature,analysisVectorLength,compatibleAnalysisFeatures,compatibleAnalysisProjections,createDefaultAnalysisBinding,createProjection,defaultNumericTransform } from '../../visualizer/bindingDefaults';
const props=defineProps<{parameter:SceneParameterDescriptor;binding:ElementBinding;project:VisualizerProjectV3;elementId:string}>();const emit=defineEmits<{change:[binding:ElementBinding]}>();
const dynamic=computed(()=>props.parameter.allowedSourceKinds.includes('analysis'));
const analysis=computed(()=>props.binding.source.kind==='analysis'?props.binding.source:null);
const features=computed(()=>compatibleAnalysisFeatures(props.parameter));
const components=computed(()=>analysis.value?analysisComponentsForFeature(analysis.value.featureId).filter(c=>props.parameter.allowedAnalysisComponents?.includes(c)):[]);
const projections=computed(()=>analysis.value?compatibleAnalysisProjections(props.parameter,analysis.value.featureId,analysis.value.component??'default'):[]);
const vectorLength=computed(()=>analysis.value?analysisVectorLength(analysis.value.featureId,analysis.value.component??'default'):0);
const transform=computed(()=>props.binding.transform??defaultNumericTransform(props.parameter,analysis.value?.featureId));
const transformFields=[{key:'inputMin',label:'输入下限'},{key:'inputMax',label:'输入上限'},{key:'outputMin',label:'输出下限'},{key:'outputMax',label:'输出上限'},{key:'attackSeconds',label:'起音（秒）'},{key:'releaseSeconds',label:'释放（秒）'}] as const;
const projectionLabels:Record<string,string>={scalar:'标量',full:'完整向量',mean:'平均值',max:'最大值',peak:'峰值位置',bin:'单个 Bin',band:'频段平均'};
const value=(event:Event)=>(event.target as HTMLInputElement).value;
function featureDisabled(id:FeatureId){const ids=new Set<FeatureId>();for(const e of props.project.elements)for(const b of e.bindings)if(!(e.id===props.elementId&&b.parameterId===props.parameter.id)&&b.source.kind==='analysis')ids.add(b.source.featureId);ids.add(id);return ids.size>4;}
function defaultBinding(id:FeatureId){return createDefaultAnalysisBinding(props.parameter,id) as ElementBinding;}
function sourceChanged(event:Event){if(value(event)==='constant')emit('change',{parameterId:props.parameter.id,source:{kind:'constant',value:structuredClone(props.parameter.defaultValue) as number|string|boolean|number[]}});else {const feature=features.value.includes('energy')?'energy':features.value[0];if(feature)emit('change',props.parameter.defaultBinding?{parameterId:props.parameter.id,...structuredClone(props.parameter.defaultBinding)} as ElementBinding:defaultBinding(feature));}}
function constantChanged(event:Event){const input=event.target as HTMLInputElement;emit('change',{parameterId:props.parameter.id,source:{kind:'constant',value:props.parameter.valueKind==='boolean'?input.checked:props.parameter.valueKind==='number'?Number(input.value):input.value}});}
function featureChanged(event:Event){emit('change',defaultBinding(value(event) as FeatureId));}
function componentChanged(event:Event){if(!analysis.value)return;const component=value(event) as VisualizerAnalysisComponent;const kinds=compatibleAnalysisProjections(props.parameter,analysis.value.featureId,component);if(kinds[0])emit('change',{...props.binding,source:{...analysis.value,component,projection:createProjection(kinds[0])}});}
function projectionChanged(event:Event){if(analysis.value)emit('change',{...props.binding,source:{...analysis.value,projection:createProjection(value(event) as VisualizerAnalysisProjectionV1['kind'])}});}
function projectionNumber(key:string,event:Event){if(analysis.value)emit('change',{...props.binding,source:{...analysis.value,projection:{...analysis.value.projection,[key]:Number(value(event))} as VisualizerAnalysisProjectionV1}});}
function transformChanged(key:string,event:Event){emit('change',{...props.binding,transform:{...transform.value,[key]:Number(value(event))}});}
function transformFlag(key:'clamp'|'invert',event:Event){emit('change',{...props.binding,transform:{...transform.value,[key]:(event.target as HTMLInputElement).checked} as VisualizerNumericTransformV1});}
</script>
