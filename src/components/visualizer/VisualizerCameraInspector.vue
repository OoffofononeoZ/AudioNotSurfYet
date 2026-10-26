<template>
    <div class="viz-panel-heading">
        <h2>属性</h2>
        <span class="viz-muted">三维场景</span>
    </div>
    <fieldset class="viz-inspector-fields app-scrollbar" :disabled="locked" :data-scene-inspector-id="scene.id">
        <section>
            <label class="viz-field"
                ><span>名称</span
                ><input
                    :value="scene.name"
                    aria-label="场景名称"
                    @change="$emit('update', { name: ($event.target as HTMLInputElement).value })"
            /></label>
            <label class="viz-field"
                ><span>起始（秒）</span
                ><AppNumberInput
                    :model-value="scene.startSeconds"
                    :min="0"
                    :max="scene.endSeconds"
                    :editing-precision="3"
                    label="场景起始时间"
                    :disabled="locked"
                    wheel-enabled
                    @change="$emit('update', { startSeconds: $event })"
            /></label>
            <label class="viz-field"
                ><span>终止（秒）</span
                ><AppNumberInput
                    :model-value="scene.endSeconds"
                    :min="scene.startSeconds"
                    :max="duration"
                    :editing-precision="3"
                    label="场景终止时间"
                    :disabled="locked"
                    wheel-enabled
                    @change="$emit('update', { endSeconds: $event })"
            /></label>
        </section>
        <section>
            <h3>基础镜头</h3>
            <VisualizerVector3Field
                :model-value="scene.camera.position"
                label="镜头位置"
                :disabled="locked"
                @change="camera({ position: $event })" />
            <VisualizerVector3Field
                :model-value="scene.camera.target"
                label="观察目标"
                :disabled="locked"
                @change="camera({ target: $event })" />
            <VisualizerVector3Field
                :model-value="scene.camera.up"
                label="镜头 up"
                :disabled="locked"
                @change="camera({ up: $event })" />
            <label v-for="field in scalarFields" :key="field.key" class="viz-field"
                ><span>{{ field.label }}</span>
                <AppNumberInput
                    :model-value="scene.camera[field.key]"
                    :min="field.min"
                    :max="field.max"
                    :editing-precision="3"
                    :label="field.label"
                    :disabled="locked"
                    wheel-enabled
                    @change="camera({ [field.key]: $event })" />
            </label>
        </section>
        <section>
            <h3>镜头轨迹</h3>
            <label class="viz-field"
                ><span>使用关键帧</span
                ><input
                    type="checkbox"
                    aria-label="使用镜头关键帧"
                    :checked="!!animation"
                    @change="toggleAnimation(($event.target as HTMLInputElement).checked)"
            /></label>
            <template v-if="animation">
                <label class="viz-field"
                    ><span>时长（秒）</span
                    ><AppNumberInput
                        :model-value="animation.durationSeconds"
                        :min="0.001"
                        :editing-precision="3"
                        label="镜头轨迹时长"
                        :disabled="locked"
                        wheel-enabled
                        @change="resizeAnimation"
                /></label>
                <label class="viz-field"
                    ><span>循环轨迹</span
                    ><input
                        type="checkbox"
                        aria-label="循环镜头轨迹"
                        :checked="animation.loop"
                        @change="changeAnimation({ loop: ($event.target as HTMLInputElement).checked })"
                /></label>
                <p class="viz-muted">时间从场景起点计算；关闭循环后停在末帧。</p>
                <div
                    v-for="(key, index) in animation.keyframes"
                    :key="scene.id + ':' + index"
                    class="viz-camera-keyframe"
                    :data-camera-keyframe="index">
                    <label class="viz-field"
                        ><span>关键帧 {{ index + 1 }}（秒）</span
                        ><AppNumberInput
                            :model-value="key.timeSeconds"
                            :min="index ? animation.keyframes[index - 1]!.timeSeconds + 0.001 : 0"
                            :max="
                                index < animation.keyframes.length - 1
                                    ? animation.keyframes[index + 1]!.timeSeconds - 0.001
                                    : animation.durationSeconds
                            "
                            :editing-precision="3"
                            :label="'关键帧 ' + (index + 1) + ' 时间'"
                            :disabled="locked || index === 0 || index === animation.keyframes.length - 1"
                            wheel-enabled
                            @change="keyframe(index, { timeSeconds: $event })"
                    /></label>
                    <VisualizerVector3Field
                        :model-value="key.position"
                        :label="'关键帧 ' + (index + 1) + ' 位置'"
                        :disabled="locked"
                        @change="keyframe(index, { position: $event })" />
                    <VisualizerVector3Field
                        :model-value="key.target"
                        :label="'关键帧 ' + (index + 1) + ' 目标'"
                        :disabled="locked"
                        @change="keyframe(index, { target: $event })" />
                    <label class="viz-field"
                        ><span>视角（度）</span
                        ><AppNumberInput
                            :model-value="key.fov"
                            :min="0.01"
                            :max="179.99"
                            :editing-precision="2"
                            :label="'关键帧 ' + (index + 1) + ' FOV'"
                            :disabled="locked"
                            wheel-enabled
                            @change="keyframe(index, { fov: $event })"
                    /></label>
                    <button
                        type="button"
                        class="viz-text-button"
                        :disabled="locked || index === 0 || index === animation.keyframes.length - 1"
                        @click="removeKey(index)">
                        删除关键帧
                    </button>
                </div>
                <button
                    type="button"
                    class="viz-text-button"
                    :disabled="locked"
                    data-testid="add-camera-keyframe"
                    @click="addKey">
                    添加关键帧
                </button>
            </template>
        </section>
    </fieldset>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import AppNumberInput from '../controls/AppNumberInput.vue';
import VisualizerVector3Field from './VisualizerVector3Field.vue';
import type { Scene3dItem, SceneCamera, CameraKeyframe } from '../../visualizer/scene3dTypes';
import { cameraPoseAt } from '../../visualizer/scene3dCodec';
const props = defineProps<{ scene: Scene3dItem; duration: number; locked: boolean }>();
const emit = defineEmits<{
    update: [patch: Partial<Pick<Scene3dItem, 'name' | 'startSeconds' | 'endSeconds' | 'camera'>>];
}>();
const animation = computed(() => props.scene.camera.animation);
const scalarFields = computed(() => [
    { key: 'fov' as const, label: '镜头 FOV（度）', min: 0.01, max: 179.99 },
    { key: 'near' as const, label: '近裁剪面', min: 0.0001, max: props.scene.camera.far - 0.0001 },
    { key: 'far' as const, label: '远裁剪面', min: props.scene.camera.near + 0.0001, max: undefined },
]);
function camera(patch: Partial<SceneCamera>) {
    emit('update', { camera: { ...structuredClone(props.scene.camera), ...patch } });
}
function changeAnimation(patch: Partial<NonNullable<SceneCamera['animation']>>) {
    if (animation.value) camera({ animation: { ...structuredClone(animation.value), ...patch } });
}
function toggleAnimation(enabled: boolean) {
    if (enabled) {
        const p = props.scene.camera;
        camera({
            animation: {
                durationSeconds: 10,
                loop: false,
                keyframes: [
                    { timeSeconds: 0, position: [...p.position], target: [...p.target], fov: p.fov },
                    { timeSeconds: 10, position: [...p.position], target: [...p.target], fov: p.fov },
                ],
            },
        });
    } else {
        const next = structuredClone(props.scene.camera);
        delete next.animation;
        emit('update', { camera: next });
    }
}
function resizeAnimation(durationSeconds: number) {
    if (animation.value)
        changeAnimation({
            durationSeconds,
            keyframes: animation.value.keyframes.map(k => ({
                ...structuredClone(k),
                timeSeconds: (k.timeSeconds / animation.value!.durationSeconds) * durationSeconds,
            })),
        });
}
function keyframe(index: number, patch: Partial<CameraKeyframe>) {
    changeAnimation({
        keyframes: animation.value!.keyframes.map((k, i) =>
            i === index ? { ...structuredClone(k), ...patch } : structuredClone(k),
        ),
    });
}
function removeKey(index: number) {
    changeAnimation({ keyframes: animation.value!.keyframes.filter((_, i) => i !== index) });
}
function addKey() {
    const a = animation.value!;
    let at = 1;
    for (let i = 2; i < a.keyframes.length; i++)
        if (
            a.keyframes[i]!.timeSeconds - a.keyframes[i - 1]!.timeSeconds >
            a.keyframes[at]!.timeSeconds - a.keyframes[at - 1]!.timeSeconds
        )
            at = i;
    const time = (a.keyframes[at - 1]!.timeSeconds + a.keyframes[at]!.timeSeconds) / 2;
    const keys = structuredClone(a.keyframes);
    keys.splice(at, 0, { timeSeconds: time, ...cameraPoseAt(props.scene.camera, time) });
    changeAnimation({ keyframes: keys });
}
</script>
<style scoped>
.viz-camera-keyframe {
    margin: 12px 0;
    padding: 12px 0;
    border-top: 1px solid #ffffff16;
}
</style>
