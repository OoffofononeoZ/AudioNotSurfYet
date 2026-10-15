<template>
    <div class="viz-panel-heading"><h2>元素</h2><button class="viz-icon-button" type="button" aria-label="添加元素" title="添加元素" :disabled="locked" data-testid="add-visualizer-element" @click="$emit('add')"><VisualizerIcon name="add"/></button></div>
    <div class="viz-element-items app-scrollbar" role="list" aria-label="可视化元素">
        <div v-for="(element,index) in elements" :key="element.id" role="listitem" class="viz-element-row" :class="{selected:selection===element.id,muted:!element.enabled}" :draggable="!locked" @dragstart="dragged=element.id" @dragover.prevent @drop.prevent="drop(element.id)" @dragend="dragged=null" :data-element-id="element.id">
            <button type="button" class="viz-element-select" :aria-pressed="selection===element.id" :disabled="locked" @click="$emit('select',element.id)"><VisualizerIcon :name="elementRegistry.get(element.type).icon"/><span>{{element.name}}</span></button>
            <div class="viz-row-actions">
                <button type="button" class="viz-icon-button small" :disabled="locked||index===0" aria-label="上移元素" title="上移" @click="move(index,-1)"><VisualizerIcon name="up"/></button>
                <button type="button" class="viz-icon-button small" :disabled="locked||index===elements.length-1" aria-label="下移元素" title="下移" @click="move(index,1)"><VisualizerIcon name="down"/></button>
                <button type="button" class="viz-icon-button small" :disabled="locked" :aria-label="element.enabled?'隐藏元素':'显示元素'" :title="element.enabled?'隐藏':'显示'" @click="$emit('visibility',element.id,!element.enabled)"><VisualizerIcon :name="element.enabled?'eye':'hidden'"/></button>
                <button type="button" class="viz-icon-button small" :disabled="locked" aria-label="删除元素" title="删除" @click="$emit('remove',element.id)"><VisualizerIcon name="trash"/></button>
            </div>
        </div>
        <div v-if="!elements.length" class="viz-list-empty"><VisualizerIcon name="layers"/><span>尚未添加元素</span></div>
    </div>
</template>
<script setup lang="ts">
import { computed,ref } from 'vue';
import VisualizerIcon from './VisualizerIcon.vue';
import { elementRegistry } from '../../visualizer/elementRegistry';
import { orderedElements } from '../../visualizer/compositionModel';
import type { VisualizerElement } from '../../visualizer/compositionTypes';
const props=defineProps<{items:VisualizerElement[];selection:string|null;locked:boolean}>();
const emit=defineEmits<{add:[];select:[id:string];visibility:[id:string,enabled:boolean];remove:[id:string];reorder:[ids:string[]]}>();
const elements=computed(()=>orderedElements(props.items).reverse());const dragged=ref<string|null>(null);
function move(index:number,offset:number){const ids=elements.value.map(e=>e.id);const [id]=ids.splice(index,1);if(id){ids.splice(index+offset,0,id);emit('reorder',ids);}}
function drop(target:string){if(props.locked||!dragged.value||target===dragged.value)return;const ids=elements.value.map(e=>e.id);const from=ids.indexOf(dragged.value),to=ids.indexOf(target);if(from<0||to<0)return;ids.splice(from,1);ids.splice(to,0,dragged.value);emit('reorder',ids);dragged.value=null;}
</script>
