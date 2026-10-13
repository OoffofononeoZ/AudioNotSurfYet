<template>
    <button v-if="isNarrow" ref="openButton" type="button" class="sidebar-opener"
        aria-label="展开侧边栏" aria-controls="app-sidebar" :aria-expanded="mobileOpen"
        data-testid="sidebar-open" @click="openMobile">
        <svg aria-hidden="true"><use href="/icons.svg#nav-menu" /></svg>
    </button>
    <button v-if="isNarrow && mobileOpen" type="button" class="sidebar-backdrop"
        aria-label="隐藏侧边栏" tabindex="-1" @click="closeMobile" />
    <component :is="isNarrow ? 'dialog' : 'aside'" id="app-sidebar" ref="sidebarElement"
        class="app-sidebar" :class="{ 'is-collapsed': collapsed }" aria-label="应用导航"
        :data-collapsed="collapsed" @close="mobileOpen = false">
        <div class="sidebar-brand-row">
            <router-link v-if="!collapsed" to="/" class="sidebar-brand" aria-label="AUDIOSURF" title="首页">
                <span class="sidebar-icon"><svg aria-hidden="true"><use href="/icons.svg#nav-home" /></svg></span>
                <span>AUDIOSURF</span>
            </router-link>
            <button type="button" class="sidebar-toggle" :aria-label="toggleLabel"
                :title="toggleLabel" :aria-expanded="isNarrow ? mobileOpen : !collapsed"
                aria-controls="app-sidebar-nav" :autofocus="isNarrow"
                data-testid="sidebar-toggle" @click="toggleSidebar">
                <svg aria-hidden="true" :class="{ 'is-reversed': collapsed }">
                    <use :href="`/icons.svg#${isNarrow ? 'nav-close' : 'nav-collapse'}`" />
                </svg>
            </button>
        </div>
        <nav id="app-sidebar-nav" class="sidebar-nav app-scrollbar" aria-label="主导航">
            <router-link v-for="item in navigation" :key="item.label" :to="item.to"
                class="sidebar-link" :class="{ 'is-active': item.active }"
                :aria-current="item.active ? 'page' : undefined" :aria-label="item.label"
                :title="collapsed ? item.label : undefined" :data-testid="item.testId">
                <span class="sidebar-icon"><svg aria-hidden="true"><use :href="`/icons.svg#${item.icon}`" /></svg></span>
                <span v-if="!collapsed">{{ item.label }}</span>
            </router-link>
        </nav>
    </component>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import { useConfigstore } from '../stores/configStore';

const route = useRoute();
const router = useRouter();
const session = useAudioSessionStore();
const config = useConfigstore();
const narrowQuery = window.matchMedia('(max-width: 767px)');
const isNarrow = ref(narrowQuery.matches);
const mobileOpen = ref(false);
const sidebarElement = useTemplateRef<HTMLElement>('sidebarElement');
const openButton = useTemplateRef<HTMLButtonElement>('openButton');
const collapsed = computed(() => !isNarrow.value && config.sidebarCollapsed);
const toggleLabel = computed(() => isNarrow.value
    ? '隐藏侧边栏' : collapsed.value ? '展开侧边栏' : '收起侧边栏');
const navigation = computed(() => [
    { label: '首页', to: '/', icon: 'nav-home', active: route.path === '/', testId: 'sidebar-home-link' },
    { label: 'Visualizer', to: { name: 'visualizer', params: { trackId: session.currentTrackId ?? undefined } },
        icon: 'nav-visualizer', active: route.name === 'visualizer', testId: 'header-visualizer-link' },
    { label: 'Analyzer', to: '/analyzer', icon: 'nav-analyzer', active: route.path === '/analyzer' },
    { label: 'Editor', to: { name: 'editor', params: { trackId: session.currentTrackId ?? undefined } },
        icon: 'nav-editor', active: route.name === 'editor', testId: 'header-editor-link' },
    { label: 'TestLands', to: '/testlands', icon: 'nav-testlands', active: route.path === '/testlands' },
]);

const openMobile = () => {
    const dialog = sidebarElement.value;
    if (!(dialog instanceof HTMLDialogElement)) return;
    dialog.show();
    mobileOpen.value = true;
};
const closeMobile = () => {
    const wasOpen = mobileOpen.value;
    const dialog = sidebarElement.value;
    if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
    mobileOpen.value = false;
    if (wasOpen) openButton.value?.focus();
};
const toggleSidebar = () => {
    if (isNarrow.value) closeMobile();
    else config.sidebarCollapsed = !config.sidebarCollapsed;
};
const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !mobileOpen.value || document.querySelector('dialog:modal')) return;
    event.preventDefault();
    closeMobile();
};
const handleNarrowChange = (event: MediaQueryListEvent) => {
    closeMobile();
    isNarrow.value = event.matches;
};
const removeAfterEach = router.afterEach((_to, _from, failure) => {
    if (!failure) closeMobile();
});
onMounted(() => {
    narrowQuery.addEventListener('change', handleNarrowChange);
    window.addEventListener('keydown', handleKeydown);
});
onUnmounted(() => {
    narrowQuery.removeEventListener('change', handleNarrowChange);
    window.removeEventListener('keydown', handleKeydown);
    removeAfterEach();
    closeMobile();
});
</script>

<style scoped>
.app-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: var(--layer-navigation);
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: var(--app-sidebar-width);
    height: 100dvh;
    padding: 20px 10px 16px;
    border-right: 1px solid var(--divider);
    background: #07100b;
    color: var(--ink);
    font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
    transition: width 180ms ease;
}
.sidebar-brand-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; height: 44px; flex: none; }
.sidebar-brand { display: flex; align-items: center; gap: 12px; color: var(--ink); text-decoration: none; }
.sidebar-icon { display: grid; place-items: center; width: 44px; height: 44px; flex: none; }
.sidebar-brand span { font-size: 15px; font-weight: 650; letter-spacing: -.04em; }
.sidebar-brand svg { width: 26px; height: 26px; color: var(--accent-soft); }
.sidebar-toggle, .sidebar-opener {
    display: grid; place-items: center; flex: none; width: 32px; height: 32px;
    border: 1px solid transparent; border-radius: 6px; background: transparent;
    color: var(--mute); cursor: pointer;
}
.sidebar-toggle svg, .sidebar-opener svg { width: 20px; height: 20px; }
.sidebar-toggle:hover { background: var(--control-hover); color: var(--ink); }
.sidebar-toggle .is-reversed { transform: rotate(180deg); }
.sidebar-nav {
    display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 0;
    width: calc(100% + 20px); margin: 30px -10px 0; overflow-x: hidden; overflow-y: auto;
}
.sidebar-link {
    display: flex; align-items: center; flex: none; gap: 12px; height: 44px;
    margin: 0 10px; padding: 0; border: 0; border-radius: 7px; color: var(--body);
    background: transparent; font: inherit; font-size: 13px; text-decoration: none;
    cursor: pointer; white-space: nowrap; text-align: left;
}
.sidebar-link svg { width: 22px; height: 22px; flex: none; }
.sidebar-link:hover { color: var(--ink); background: var(--control-hover); }
.sidebar-link.is-active { color: var(--accent-soft); background: var(--marker-fill-soft); }
.is-collapsed .sidebar-brand-row { justify-content: flex-start; }
.is-collapsed .sidebar-toggle { width: 44px; height: 44px; border-radius: 7px; }
.is-collapsed .sidebar-nav { width: var(--app-sidebar-width); }
.is-collapsed .sidebar-link { width: 44px; margin-right: 0; }
.sidebar-opener {
    position: fixed; top: 12px; left: 12px; z-index: var(--layer-navigation);
    width: 36px; height: 36px; border-color: var(--divider); background: var(--surface-1); color: var(--ink);
}
.sidebar-backdrop {
    position: fixed; inset: 0; z-index: calc(var(--layer-navigation) - 1);
    border: 0; padding: 0; background: rgba(0, 0, 0, .62); cursor: default;
}
a:focus-visible, button:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: 2px; border-radius: 6px; }
@media (max-width: 767px) {
    .app-sidebar { width: 216px; max-width: 100%; max-height: none; margin: 0; border: 0; border-right: 1px solid var(--divider); }
    .app-sidebar:not([open]) { display: none; }
}
</style>
