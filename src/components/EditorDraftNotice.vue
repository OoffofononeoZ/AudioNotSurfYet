<template>
    <section class="editor-notice" data-testid="editor-draft-conflict" :aria-labelledby="titleId">
        <div class="editor-notice__body">
            <div class="editor-notice__icon"><EditorIcon name="overlay" /></div>
            <h2 :id="titleId">另一首歌曲已有草稿</h2>
            <p v-if="message" class="editor-notice__description">{{ message }}</p>
            <div v-if="fileName" class="editor-notice__file" :title="fileName">
                <EditorIcon name="music" /><span>{{ fileName }}</span>
            </div>
            <p v-if="exported" class="editor-notice__status" role="status">
                旧工程已导出；仍需明确选择“覆盖草稿”才能继续。
            </p>
        </div>
        <footer class="editor-notice__actions">
            <button type="button" class="editor-notice__quiet" data-testid="cancel-editor-entry" @click="$emit('cancel')">取消进入</button>
            <button type="button" class="editor-notice__secondary" data-testid="export-conflicting-draft" @click="$emit('export')"><EditorIcon name="export" />导出旧工程</button>
            <button type="button" class="editor-notice__primary" data-testid="overwrite-conflicting-draft" @click="$emit('replace')">覆盖草稿<EditorIcon name="right" /></button>
        </footer>
    </section>
</template>

<script setup lang="ts">
import { useId } from 'vue';
import EditorIcon from './EditorIcon.vue';
import '../editor/notices.css';

defineProps<{ fileName?: string; message?: string; exported: boolean }>();
defineEmits<{ export: []; replace: []; cancel: [] }>();
const titleId = useId();
</script>
