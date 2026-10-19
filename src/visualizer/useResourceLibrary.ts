import { inject, provide, shallowRef, onMounted, onBeforeUnmount, type InjectionKey, type ShallowRef } from 'vue';
import { VisualizerResourceLibrary, type ResourceLibraryState } from './resourceLibrary';
import type { validateRuntimeSnapshot } from './validateRuntimeSnapshot';
const key: InjectionKey<{ library: VisualizerResourceLibrary; state: ShallowRef<ResourceLibraryState> }> =
    Symbol('visualizer-resource-library');
export function provideResourceLibrary(validate: typeof validateRuntimeSnapshot) {
    const library = new VisualizerResourceLibrary({ validate }),
        state = shallowRef(library.snapshot());
    const detach = library.subscribe(value => (state.value = value));
    provide(key, { library, state });
    onMounted(() => void library.restore());
    onBeforeUnmount(() => {
        detach();
        library.dispose();
    });
    return { library, state };
}
export function useResourceLibrary() {
    const value = inject(key);
    if (!value) throw Error('资源库尚未初始化。');
    return value;
}
