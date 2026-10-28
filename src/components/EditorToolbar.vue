<template>
    <header class="editor-toolbar" data-testid="editor-toolbar" aria-label="Editor 工程与工作区">
        <div class="project-actions">
            <button
                type="button"
                class="editor-icon-button"
                :disabled="!ready && !canImportOsu"
                aria-label="导入"
                title="导入"
                data-testid="import-editor-project"
                @click="emit('import')">
                <EditorIcon name="import" />
            </button>
            <button
                type="button"
                class="editor-icon-button"
                :disabled="!ready"
                aria-label="导出工程（JSON V2）"
                title="导出工程（JSON V2）"
                data-testid="export-editor-project"
                @click="emit('export')">
                <EditorIcon name="export" />
            </button>
        </div>
        <nav class="editor-tabs" aria-label="Editor 工作区" role="tablist" @keydown="switchFromKeyboard">
            <button
                v-for="tab in tabs"
                :id="`editor-${tab.id}-tab`"
                :key="tab.id"
                type="button"
                role="tab"
                :aria-label="tab.label + (tab.id === 'marking' ? '' : '（实验性）')"
                :aria-controls="`editor-${tab.id}-panel`"
                :aria-selected="workspace === tab.id"
                :tabindex="workspace === tab.id ? 0 : -1"
                :disabled="!ready"
                :data-testid="`editor-${tab.id}-tab`"
                @click="emit('update:workspace', tab.id)">
                {{ tab.label }}<span v-if="tab.id !== 'marking'" class="editor-exp-badge" aria-hidden="true">exp</span>
            </button>
        </nav>
        <div class="toolbar-status">
            <span
                class="persistence-state"
                :data-state="persistence"
                aria-live="polite"
                data-testid="editor-save-state"
                >{{ ready ? persistenceLabel : '新工程' }}</span
            >
            <div id="editor-overlay-slot" class="overlay-slot" />
        </div>
    </header>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { EditorSessionSnapshot } from '../editor/types';
import EditorIcon from './EditorIcon.vue';
type Workspace = 'marking' | 'separation' | 'transcription';
const props = defineProps<{
    ready: boolean;
    canImportOsu: boolean;
    workspace: Workspace;
    persistence: EditorSessionSnapshot['persistence'];
}>();
const emit = defineEmits<{ 'update:workspace': [workspace: Workspace]; import: []; export: [] }>();
const tabs = [
    { id: 'marking', label: '标记编辑' },
    { id: 'separation', label: '音轨分离' },
    { id: 'transcription', label: '自动标记' },
] as const;
const persistenceLabel = computed(
    () => ({ clean: '新工程', saving: '保存中', saved: '已保存', 'not-persisted': '未保存' })[props.persistence],
);
function switchFromKeyboard(event: KeyboardEvent) {
    if (!props.ready || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex(tab => tab.id === props.workspace);
    const next =
        tabs[
            event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabs.length - 1
                  : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
        ]!;
    emit('update:workspace', next.id);
    document.getElementById(`editor-${next.id}-tab`)?.focus();
}
</script>
<style scoped>
.editor-toolbar {
    position: sticky;
    top: 0;
    z-index: var(--layer-sticky);
    flex: none;
    display: grid;
    grid-template-columns: minmax(72px, 1fr) auto minmax(150px, 1fr);
    align-items: center;
    column-gap: 12px;
    height: 64px;
    min-height: 64px;
    padding: 0 60px 0 14px;
    border-bottom: 1px solid var(--divider);
    background: var(--canvas);
}
.project-actions,
.toolbar-status,
.editor-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
}
.toolbar-status {
    justify-content: flex-end;
    gap: 12px;
}
.persistence-state {
    white-space: nowrap;
    font-size: 11px;
    color: var(--mute);
}
.persistence-state[data-state='not-persisted'] {
    color: var(--error);
}
.overlay-slot {
    width: 72px;
    height: 34px;
    flex: none;
}
.editor-tabs {
    gap: 24px;
    height: 100%;
}
.editor-tabs button {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    padding: 0 2px;
    border: 0;
    border-radius: 0;
    color: var(--mute);
    background: transparent;
    font-size: 12px;
    white-space: nowrap;
}
.editor-tabs button[aria-selected='true'] {
    color: var(--accent-soft);
}
.editor-tabs button[aria-selected='true']::after {
    content: '';
    position: absolute;
    height: 2px;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--accent-soft);
}
.editor-tabs button:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: -4px;
}
button:disabled {
    opacity: 0.35;
    cursor: default;
}
@container app-workspace (max-width: 799px) {
    .editor-toolbar {
        grid-template-columns: 1fr auto;
        height: 106px;
        grid-template-rows: 63px 42px;
    }
    .editor-tabs {
        grid-column: 1 / -1;
        grid-row: 2;
        justify-content: center;
        gap: 16px;
        height: 42px;
    }
    .toolbar-status {
        grid-column: 2;
        grid-row: 1;
    }
}
@media (max-width: 767px) {
    .editor-toolbar {
        padding-left: 60px;
        column-gap: 4px;
    }
    .toolbar-status {
        gap: 8px;
    }
}
</style>
