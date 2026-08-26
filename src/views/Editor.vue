<template>
    <main class="editor-page" data-testid="editor-page">
        <section class="editor-shell">
            <header class="editor-heading">
                <div>
                    <p class="kicker">Editor · E1 foundation</p>
                    <h1>逆向制曲工程</h1>
                    <p>在不修改原音频的前提下，为歌曲建立可恢复、可导出的时间标注工程。</p>
                </div>
                <span class="state-badge" :data-state="snapshot.state">
                    {{ stateLabel }}
                </span>
            </header>

            <section v-if="snapshot.state === 'empty'" class="editor-state" data-testid="editor-empty">
                <h2>先选择一首歌曲</h2>
                <p>可以在底部播放器导入或选择歌曲，再从导航栏 Editor 进入。</p>
            </section>

            <section v-else-if="snapshot.state === 'loading'" class="editor-state" aria-live="polite">
                <h2>正在准备歌曲和草稿…</h2>
            </section>

            <section v-else-if="snapshot.state === 'unavailable'" class="editor-state" data-testid="editor-unavailable">
                <h2>这首歌曲暂时不能编辑</h2>
                <p role="alert">{{ snapshot.message }}</p>
                <p>请在底部播放器恢复文件访问或重新选择相同文件。</p>
            </section>

            <section v-else-if="snapshot.state === 'draft-error'" class="editor-state" data-testid="editor-draft-error">
                <h2>保存的 Editor 草稿无法读取</h2>
                <p role="alert">{{ snapshot.message }}</p>
                <button type="button" @click="clearInvalidDraft">清除损坏草稿并新建</button>
            </section>

            <section v-else-if="snapshot.state === 'draft-conflict'" class="editor-state conflict" data-testid="editor-draft-conflict">
                <h2>另一首歌曲已有草稿</h2>
                <p>{{ snapshot.message }}</p>
                <p v-if="snapshot.conflictingDraft">
                    旧工程：{{ snapshot.conflictingDraft.project.track.fileName }}
                </p>
                <p v-if="conflictExported" class="success-message">
                    旧工程已导出；仍需明确选择“覆盖草稿”才能继续。
                </p>
                <div class="button-row">
                    <button type="button" data-testid="export-conflicting-draft" @click="exportConflict">
                        导出旧工程
                    </button>
                    <button type="button" data-testid="overwrite-conflicting-draft" @click="overwriteConflict">
                        覆盖草稿
                    </button>
                    <button type="button" data-testid="cancel-editor-entry" @click="cancelConflict">
                        取消进入
                    </button>
                </div>
            </section>

            <template v-else-if="snapshot.state === 'ready' && snapshot.project">
                <section class="track-panel" data-testid="editor-ready">
                    <div>
                        <p class="kicker">当前工程</p>
                        <h2>{{ snapshot.project.track.title || snapshot.project.track.fileName }}</h2>
                        <p>
                            {{ snapshot.project.track.artist || 'unknown' }} ·
                            {{ formatTime(playback.durationSeconds) }} ·
                            JSON V1
                        </p>
                    </div>
                    <div class="transport" aria-label="Editor 播放控制">
                        <button type="button" data-testid="editor-playback-toggle" @click="togglePlayback">
                            {{ playback.state === 'playing' ? '暂停' : '播放' }}
                        </button>
                        <span data-testid="editor-current-time">
                            {{ formatTime(playback.currentTimeSeconds) }} / {{ formatTime(playback.durationSeconds) }}
                        </span>
                        <span class="repeat-badge" data-testid="editor-repeat-state">单曲循环</span>
                    </div>
                    <div class="project-actions">
                        <label>
                            工程格式
                            <select v-model="codecId" aria-label="工程格式">
                                <option v-for="codec in codecs" :key="codec.id" :value="codec.id">
                                    {{ codec.label }}
                                </option>
                            </select>
                        </label>
                        <button type="button" data-testid="import-editor-project" @click="importProject">
                            导入工程
                        </button>
                        <button type="button" data-testid="export-editor-project" @click="exportProject">
                            导出工程
                        </button>
                    </div>
                    <p class="persistence-state" :data-state="snapshot.persistence" aria-live="polite">
                        {{ persistenceLabel }}
                    </p>
                    <p v-if="snapshot.message" role="alert" class="error-message">{{ snapshot.message }}</p>
                </section>

                <EditorTimeline
                    :project="snapshot.project"
                    :playback="playback"
                    :analysis="analysisSnapshot"
                    :buffer-series="bufferSeries"
                    :tempo-estimate-state="snapshot.tempoEstimateState"
                    @update-project="updateProject"
                />

                <section class="future-panel" aria-label="Editor 后续工作区">
                    <div>
                        <p class="kicker">E3–E5</p>
                        <h2>点、范围与分析叠加</h2>
                        <p>当前 E2 只开放时间轴和 Tempo，不提前暴露不可用标记控件。</p>
                    </div>
                </section>
            </template>
        </section>
    </main>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref, watch } from 'vue';
import {
    onBeforeRouteLeave,
    useRoute,
    useRouter,
} from 'vue-router';
import {
    ElCheckbox,
    ElMessage,
    ElMessageBox,
} from 'element-plus';
import { useAudioSessionService } from '../audio/audioSessionService';
import { EditorFormatCodecRegistry } from '../editor/projectCodec';
import { useEditorSessionController } from '../editor/editorSessionController';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import EditorTimeline from '../components/EditorTimeline.vue';
import type { EditorProjectV1 } from '../editor/types';

const route = useRoute();
const router = useRouter();
const audioSession = useAudioSessionService();
const sessionStore = useAudioSessionStore();
const controller = useEditorSessionController();
const snapshot = ref(controller.getSnapshot());
const unsubscribe = controller.subscribe((next) => {
    snapshot.value = next;
});
const analysisSnapshot = ref(controller.getAnalysisSnapshot());
const unsubscribeAnalysis = controller.subscribeAnalysis((next) => {
    analysisSnapshot.value = next;
});
const bufferSeries = computed(() => {
    void analysisSnapshot.value.generation;
    void analysisSnapshot.value.readyFeatureIds;
    return controller.getAnalysisSeries('buffer');
});
const codecRegistry = new EditorFormatCodecRegistry();
const codecs = codecRegistry.list();
const codecId = ref('json-v1');
const conflictExported = ref(false);
const historyBack = window.history.state?.back;
const returnPath = typeof historyBack === 'string'
    && !historyBack.startsWith('/editor')
    ? historyBack
    : '/';

const playback = computed(() => sessionStore.playback);
const routeTrackId = () => {
    const value = route.params.trackId;
    return typeof value === 'string' && value.length > 0 ? value : null;
};

const stateLabel = computed(() => ({
    empty: '等待歌曲',
    loading: '正在载入',
    ready: snapshot.value.restoredFromDraft ? '草稿已恢复' : '工程已就绪',
    'draft-conflict': '需要处理旧草稿',
    unavailable: '歌曲不可用',
    'draft-error': '草稿损坏',
})[snapshot.value.state]);

const persistenceLabel = computed(() => ({
    clean: '新工程已在内存中建立',
    saving: '正在保存本地草稿…',
    saved: '本地草稿已保存',
    'not-persisted': '草稿未持久化；当前页面内容仍可使用',
})[snapshot.value.persistence]);

const formatTime = (seconds: number): string => {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${Math.floor(safe % 60).toString().padStart(2, '0')}`;
};

watch(
    () => route.params.trackId,
    () => {
        conflictExported.value = false;
        if (sessionStore.persistence.state !== 'restoring') {
            void controller.enter(routeTrackId());
        }
    },
    { immediate: true },
);

watch(
    () => sessionStore.persistence.state,
    (state, previous) => {
        if (previous === 'restoring' && state !== 'restoring') {
            void controller.enter(routeTrackId());
        }
    },
);

const togglePlayback = () => void audioSession.togglePlayback();

const importProject = async () => {
    try {
        const result = await controller.importProject(codecId.value);
        if (result === 'imported') ElMessage.success('工程已导入并写入本地草稿。');
    } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '工程导入失败。');
    }
};

const exportProject = async () => {
    try {
        const result = await controller.exportProject(codecId.value);
        if (result === 'saved') ElMessage.success('工程已导出。');
    } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '工程导出失败。');
    }
};

const exportConflict = async () => {
    try {
        conflictExported.value = await controller.exportConflictingDraft()
            === 'saved';
    } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '旧工程导出失败。');
    }
};

const overwriteConflict = async () => {
    await controller.overwriteConflictingDraft();
};

const cancelConflict = async () => {
    const result = await controller.cancelConflictingEntry();
    if (result.kind === 'restored-old') {
        await router.replace({ name: 'editor', params: { trackId: result.trackId } });
    } else {
        await router.replace(returnPath);
    }
};

const clearInvalidDraft = () => void controller.clearInvalidDraftAndCreate();
const updateProject = (
    project: EditorProjectV1,
    immediate: boolean,
) => controller.updateProject(project, immediate);

onBeforeRouteLeave(async () => {
    if (controller.shouldWarnOnLeave()) {
        let suppress = false;
        try {
            await ElMessageBox.confirm(
                h('div', [
                    h('p', '如果之后用其他歌曲进入 Editor，当前单草稿可能被覆盖。建议先导出工程。'),
                    h(ElCheckbox, {
                        modelValue: suppress,
                        'onUpdate:modelValue': (value: boolean | string | number) => {
                            suppress = Boolean(value);
                        },
                    }, () => '之后不再显示普通离页提示'),
                ]),
                '离开 Editor？',
                {
                    confirmButtonText: '仍然离开',
                    cancelButtonText: '留在此页',
                    type: 'warning',
                },
            );
        } catch {
            return false;
        }
        if (suppress) await controller.setLeaveWarningEnabled(false);
    }
    await controller.leave();
    return true;
});

onBeforeUnmount(() => {
    unsubscribe();
    unsubscribeAnalysis();
});
</script>

<style scoped>
.editor-page {
    min-height: 100dvh;
    padding: 88px 24px 40px;
    color: #eafff2;
    background:
        radial-gradient(circle at 20% 0%, rgba(51, 255, 153, 0.12), transparent 35%),
        #020403;
}

.editor-shell {
    width: min(1440px, 100%);
    margin: 0 auto;
}

.editor-heading,
.track-panel,
.editor-state,
.future-panel > div {
    border: 1px solid rgba(72, 255, 151, 0.28);
    border-radius: 24px;
    background: rgba(3, 12, 8, 0.82);
    box-shadow: inset 0 0 32px rgba(23, 255, 128, 0.035);
}

.editor-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding: 28px;
}

.editor-heading h1,
.track-panel h2,
.editor-state h2,
.future-panel h2 {
    margin: 4px 0 8px;
    color: #fff;
}

.kicker,
.state-badge,
.repeat-badge {
    color: #65ffa9;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.state-badge,
.repeat-badge {
    border: 1px solid rgba(101, 255, 169, 0.45);
    border-radius: 999px;
    padding: 8px 12px;
    white-space: nowrap;
}

.editor-state,
.track-panel {
    margin-top: 20px;
    padding: 28px;
}

.button-row,
.transport,
.project-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 18px;
}

button,
select {
    border: 1px solid rgba(101, 255, 169, 0.48);
    border-radius: 12px;
    padding: 10px 14px;
    color: #effff6;
    background: rgba(7, 24, 15, 0.9);
}

button:hover {
    border-color: #65ffa9;
    background: rgba(19, 69, 42, 0.9);
}

button:focus-visible,
select:focus-visible {
    outline: 2px solid #65ffa9;
    outline-offset: 3px;
}

.project-actions label {
    display: flex;
    align-items: center;
    gap: 8px;
}

.persistence-state,
.error-message,
.success-message {
    margin-top: 14px;
}

.error-message {
    color: #ffb0a8;
}

.success-message {
    color: #65ffa9;
}

.future-panel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.future-panel > div {
    min-height: 220px;
    padding: 28px;
    opacity: 0.72;
}

@media (max-width: 800px) {
    .editor-page {
        padding-inline: 12px;
    }

    .editor-heading,
    .future-panel {
        grid-template-columns: 1fr;
        flex-direction: column;
    }
}
</style>
