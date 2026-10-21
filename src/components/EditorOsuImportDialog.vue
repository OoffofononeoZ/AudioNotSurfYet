<template>
    <dialog
        ref="dialog"
        class="osu-import-dialog app-scrollbar"
        aria-labelledby="osu-import-title"
        data-testid="osu-import-dialog"
        @cancel.prevent="cancel">
        <header>
            <h2 id="osu-import-title">导入 osu 谱面</h2>
            <button type="button" :disabled="phase === 'applying'" aria-label="关闭谱面导入" @click="cancel">×</button>
        </header>
        <div class="source-row">
            <button type="button" :disabled="busy" data-testid="osu-select-source" @click="chooseSource">
                选择 .osu / .osz</button
            ><span>{{ sourceName || '尚未选择谱面' }}</span>
        </div>
        <template v-if="entries.length">
            <label class="field"
                ><span>难度</span
                ><select v-model="selectedIndex" :disabled="busy" data-testid="osu-difficulty">
                    <option
                        v-for="(entry, index) in entries"
                        :key="entry.path"
                        :value="index"
                        :disabled="!entry.beatmap">
                        {{
                            entry.beatmap
                                ? `${entry.beatmap.difficulty} · ${modeName(entry.beatmap.mode)}`
                                : `${entry.path}（${entry.error}）`
                        }}
                    </option>
                </select></label
            >
            <p v-if="selected?.beatmap" class="map-info">
                {{ selected.beatmap.artist }} · {{ selected.beatmap.title }}<br />{{ selected.beatmap.creator }} ·
                {{ selected.beatmap.objects.length }} 个物件 · 引用音频：{{ selected.beatmap.audioFilename }}
            </p>
            <fieldset :disabled="busy">
                <legend>音频</legend>
                <label v-if="hasArchive"
                    ><input v-model="audioMode" type="radio" value="source" name="osu-audio" />使用包内原音频</label
                >
                <label v-if="project"
                    ><input v-model="audioMode" type="radio" value="current" name="osu-audio" />使用当前歌曲</label
                >
                <label><input v-model="audioMode" type="radio" value="file" name="osu-audio" />另选音频</label>
                <div v-if="audioMode === 'file'" class="source-row">
                    <button type="button" data-testid="osu-select-audio" @click="chooseAudio">选择音频</button
                    ><span>{{ audioName || '尚未选择音频' }}</span>
                </div>
                <label v-if="audioMode === 'current' && !hasArchive" class="confirmation"
                    ><input
                        v-model="currentConfirmed"
                        type="checkbox"
                        data-testid="osu-confirm-current" />确认当前歌曲与谱面引用的音频一致</label
                >
            </fieldset>
            <fieldset :disabled="busy" class="content-options">
                <legend>导入内容</legend>
                <label
                    ><input
                        v-model="options.notes"
                        type="checkbox"
                        data-testid="osu-notes" />音符标记（追加新轨道）</label
                >
                <label
                    ><input
                        v-model="options.replaceTempo"
                        type="checkbox"
                        data-testid="osu-tempo"
                        @change="touchTempo" />填入谱面 BPM 与节拍分段（替换当前分段）</label
                >
                <label><input v-model="options.bookmarks" type="checkbox" data-testid="osu-bookmarks" />书签</label>
                <label><input v-model="options.breaks" type="checkbox" data-testid="osu-breaks" />休息区间</label>
                <label><input v-model="options.kiai" type="checkbox" data-testid="osu-kiai" />Kiai</label>
            </fieldset>
        </template>
        <section v-if="summary" class="preview" data-testid="osu-preview" aria-label="谱面导入预览">
            <strong>{{ summary.fileName }}</strong>
            <p>新增 {{ summary.lanes }} 条轨道：{{ summary.points }} 个点、{{ summary.ranges }} 个范围</p>
            <p>{{ summary.segments }} 个定时分段 · {{ summary.bpm }} BPM</p>
        </section>
        <p v-if="busy" role="status">
            {{ phase === 'reading' ? '正在读取文件…' : phase === 'preparing' ? '正在准备音频和标记…' : '正在应用…' }}
        </p>
        <p v-if="error" class="error" role="alert" data-testid="osu-import-error">{{ error }}</p>
        <footer>
            <button
                type="button"
                :disabled="busy || !selected?.beatmap"
                data-testid="osu-build-preview"
                @click="preview">
                预览导入</button
            ><button type="button" class="primary" :disabled="!canApply" data-testid="osu-apply" @click="apply">
                应用</button
            ><button type="button" :disabled="phase === 'applying'" data-testid="osu-cancel" @click="cancel">
                取消
            </button>
        </footer>
    </dialog>
</template>
<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue';
import type { EditorProjectV2 } from '../editor/types';
import type { OsuImportApplication } from '../editor/osu/osuTypes';
import { useOsuImport } from '../editor/osu/useOsuImport';
const props = defineProps<{
    project: EditorProjectV2 | null;
    trackId: string | null;
    apply: (intent: OsuImportApplication) => Promise<boolean>;
}>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const {
    entries,
    selectedIndex,
    selected,
    sourceName,
    audioMode,
    audioName,
    currentConfirmed,
    options,
    phase,
    error,
    busy,
    hasArchive,
    summary,
    chooseSource,
    chooseAudio,
    preview,
    apply,
    touchTempo,
    canApply,
} = useOsuImport(props, () => emit('close'));
const modeName = (mode: number) => ({ 0: '标准', 1: '太鼓', 3: 'mania' })[mode];
function cancel() {
    if (phase.value !== 'applying') emit('close');
}
onMounted(async () => {
    await nextTick();
    dialog.value?.showModal();
});
onBeforeUnmount(() => dialog.value?.close());
</script>
<style scoped>
.osu-import-dialog {
    width: min(700px, calc(100vw - 32px));
    max-height: calc(100dvh - 48px);
    padding: 22px;
    border: 1px solid var(--hairline-focus);
    border-radius: 6px;
    background: var(--surface-2);
    color: var(--ink);
    font-size: 13px;
}
.osu-import-dialog::backdrop {
    background: var(--editor-modal-backdrop);
}
header,
footer,
.source-row {
    display: flex;
    align-items: center;
    gap: 10px;
}
header {
    justify-content: space-between;
    margin-bottom: 18px;
}
h2 {
    margin: 0;
    font-size: 17px;
}
button,
select {
    min-height: 34px;
    padding: 6px 10px;
    border: 1px solid var(--hairline);
    border-radius: 4px;
    background: var(--editor-control);
    color: var(--ink);
    font: inherit;
}
button:disabled,
fieldset:disabled {
    opacity: 0.5;
}
button:focus-visible,
select:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 2px;
}
.primary {
    color: var(--accent-soft);
}
.source-row span,
.map-info {
    color: var(--body);
    overflow-wrap: anywhere;
}
.field {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    margin-top: 16px;
}
.map-info {
    line-height: 1.7;
    margin: 12px 0;
}
fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 18px;
    margin: 16px 0;
    padding: 12px;
    border: 1px solid var(--divider);
}
fieldset label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.confirmation,
fieldset .source-row {
    flex-basis: 100%;
}
.content-options {
    display: grid;
}
.preview {
    padding: 12px;
    border: 1px solid var(--divider);
    background: var(--surface-1);
}
.preview p {
    margin: 8px 0 0;
    color: var(--body);
}
.error {
    color: var(--error);
    overflow-wrap: anywhere;
}
footer {
    justify-content: flex-end;
    margin-top: 20px;
    flex-wrap: wrap;
}
</style>
