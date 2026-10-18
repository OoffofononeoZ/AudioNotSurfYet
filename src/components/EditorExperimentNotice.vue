<template>
    <section class="editor-notice" :data-testid="`editor-${feature}-notice`" :aria-labelledby="titleId">
        <div class="editor-notice__body">
            <div class="editor-notice__icon"><EditorIcon name="experiment" /></div>
            <h2 :id="titleId">{{ feature === 'separation' ? '音轨分离' : '自动标记' }}仍在实验中</h2>
            <p class="editor-notice__description">{{ feature === 'separation'
                ? '分离结果可能存在串音或遗漏，处理可能需要较长时间。请试听确认后再导出。'
                : '自动标记可能存在漏检、误检和串音。请检查并修正候选后，再添加为新标记轨。' }}</p>
            <p class="editor-notice__description">音频在本地处理，首次使用需要下载模型。</p>
        </div>
        <footer class="editor-notice__actions">
            <button type="button" class="editor-notice__quiet" data-testid="editor-experiment-cancel" @click="$emit('cancel')">返回标记编辑</button>
            <button type="button" class="editor-notice__primary" :data-testid="`editor-${feature}-continue`" @click="$emit('continue')">了解，继续<EditorIcon name="right" /></button>
        </footer>
    </section>
</template>
<script setup lang="ts">
import { useId } from 'vue';
import EditorIcon from './EditorIcon.vue';
import '../editor/notices.css';

defineProps<{ feature: 'separation' | 'transcription' }>();
defineEmits<{ continue: []; cancel: [] }>();
const titleId = useId();
</script>
