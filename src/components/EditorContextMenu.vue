<template>
    <Teleport to="body">
        <div ref="menu" class="editor-context-menu app-scrollbar" role="menu" aria-label="时间轴操作"
            :data-testid="testId" :style="{ left: `${position.x}px`, top: `${position.y}px` }"
            @contextmenu.prevent @keydown="onKeydown">
            <button v-for="item in items" :key="item.id" type="button" role="menuitem" @click="select(item.id)">{{ item.label }}</button>
        </div>
    </Teleport>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { claimEditorContextMenu } from '../editor/contextMenuOwnership';

const props = defineProps<{ anchor: HTMLElement | null | undefined; x: number; y: number; testId: string }>();
const emit = defineEmits<{ action: [id: 'seek' | 'play' | 'center']; close: [] }>();
const items = [{ id: 'seek', label: '跳到此处' }, { id: 'play', label: '从此处播放' }, { id: 'center', label: '将此处居中' }] as const;
const menu = ref<HTMLElement | null>(null);
const position = reactive({ x: 8, y: 8 });
let release: (() => void) | undefined;
let disposed = false;
const close = () => emit('close');
const returnFocus = () => props.anchor?.isConnected && props.anchor.focus({ preventScroll: true });
function select(id: 'seek' | 'play' | 'center') { emit('action', id); close(); returnFocus(); }
function outside(event: PointerEvent) { if (!menu.value?.contains(event.target as Node)) close(); }
function scroll(event: Event) { if (!menu.value?.contains(event.target as Node)) close(); }
function onKeydown(event: KeyboardEvent) {
    const buttons = [...menu.value!.querySelectorAll<HTMLButtonElement>('button')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape' || event.key === 'Tab') {
        if (event.key === 'Escape') event.preventDefault();
        close(); returnFocus(); return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus({ preventScroll: true });
}
onMounted(async () => {
    release = claimEditorContextMenu(close);
    await nextTick();
    if (disposed || !menu.value) return;
    const anchor = props.anchor?.getBoundingClientRect();
    const x = (anchor?.left ?? 0) + props.x, y = (anchor?.top ?? 0) + props.y;
    const bounds = menu.value.getBoundingClientRect();
    position.x = Math.max(8, Math.min(innerWidth - bounds.width - 8, x + bounds.width > innerWidth - 8 ? x - bounds.width : x));
    position.y = Math.max(8, Math.min(innerHeight - bounds.height - 8, y + bounds.height > innerHeight - 8 ? y - bounds.height : y));
    menu.value.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);
});
onBeforeUnmount(() => {
    disposed = true; release?.();
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('scroll', scroll, true);
    window.removeEventListener('resize', close);
});
</script>
<style scoped>
.editor-context-menu { position:fixed; z-index:120; display:grid; min-width:174px; max-width:calc(100vw - 16px); max-height:calc(100dvh - 16px); overflow:auto; padding:5px; border:1px solid var(--hairline-focus); border-radius:6px; background:var(--editor-menu); box-shadow:0 12px 32px #0008; }
button { min-height:34px; border:0; border-radius:3px; padding:7px 12px; text-align:left; color:var(--ink); background:transparent; font-size:12px; cursor:pointer; }
button:hover,button:focus-visible { outline:0; background:var(--control-active); color:var(--accent-soft); }
</style>
