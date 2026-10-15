<template>
    <dialog ref="dialog" class="viz-catalog" aria-labelledby="element-catalog-title" @cancel.prevent="$emit('close')" @click="backdrop">
        <header><h2 id="element-catalog-title">添加元素</h2><button type="button" class="viz-icon-button" aria-label="关闭元素库" @click="$emit('close')"><VisualizerIcon name="close"/></button></header>
        <div class="viz-catalog-filters"><div role="group" aria-label="元素分类"><button v-for="entry in categories" :key="entry.id" type="button" :aria-pressed="category===entry.id" @click="category=entry.id">{{entry.label}}</button></div><input v-model="query" type="search" aria-label="搜索元素" placeholder="搜索元素"/></div>
        <div class="viz-catalog-grid app-scrollbar"><button v-for="descriptor in filtered" :key="descriptor.id" type="button" class="viz-catalog-card" :data-element-type="descriptor.id" @click="$emit('add',descriptor.id)"><div class="viz-catalog-preview" :class="descriptor.icon"><VisualizerIcon :name="descriptor.icon"/></div><span>{{descriptor.title}}</span><VisualizerIcon name="add"/></button><p v-if="!filtered.length">没有匹配的元素</p></div>
    </dialog>
</template>
<script setup lang="ts">
import { computed,ref,watch,nextTick } from 'vue';
import VisualizerIcon from './VisualizerIcon.vue';
import { elementRegistry } from '../../visualizer/elementRegistry';
import type { ElementType } from '../../visualizer/compositionTypes';
const props=defineProps<{open:boolean}>();
const dialog=ref<HTMLDialogElement|null>(null),query=ref(''),category=ref('all');
const categories=[{id:'all',label:'全部'},{id:'visual',label:'视觉'},{id:'modifier',label:'影响效果'},{id:'transition',label:'转场'}];
const filtered=computed(()=>elementRegistry.list().filter(e=>(category.value==='all'||e.kind===category.value)&&e.title.includes(query.value.trim())));
watch(()=>props.open,async open=>{await nextTick();if(open&&!dialog.value?.open){query.value='';dialog.value?.showModal();}else if(!open)dialog.value?.close();},{immediate:true});
const emit=defineEmits<{close:[];add:[type:ElementType]}>();
function backdrop(event:MouseEvent){const element=dialog.value;if(!element||event.target!==element)return;const r=element.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)emit('close');}
</script>
