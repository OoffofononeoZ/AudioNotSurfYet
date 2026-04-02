<template>
    <div ref="containerRef" :class="`relative w-[500px] ${className}`.trim()">
        <div ref="listRef" :class="`overflow-y-auto p-2 ${displayScrollbar
            ? '[&::-webkit-scrollbar]:w-[8px] [&::-webkit-scrollbar-track]:bg-[#0b0b0b] [&::-webkit-scrollbar-thumb]:bg-[#222] [&::-webkit-scrollbar-thumb]:rounded-[4px]'
            : 'scrollbar-hide'
            }`" :style="{
                scrollbarWidth: displayScrollbar ? 'thin' : 'none',
                scrollbarColor: '#222 #0b0b0b',
            }" @scroll="handleScroll">
            <div v-for="(item, index) in items" :key="index" ref="itemRefs" :data-index="index"
                class="mb-4 cursor-pointer opacity-0 scale-70" @mouseenter="() => setSelectedIndex(index)" @click="
                    () => {
                        setSelectedIndex(index);
                        emit('itemSelected', item, index);
                    }
                ">
                <div
                    :class="`p-2 bg-[#282828] rounded-lg ${selectedIndex === index ? 'bg-[#3a3a3a]' : ''} ${itemClassName}`">
                    <slot :name="item" :index="index" :data="slotData[index]">
                        <p class="text-white m-0">{{ item }}</p>
                    </slot>
                </div>
            </div>
        </div>

        <div v-if="showGradients" :style="{ opacity: topGradientOpacity }"
            class="absolute top-0 left-0 right-0 h-[50px] bg-gradient-to-b from-[#0b0b0b] to-transparent pointer-events-none transition-opacity duration-300 ease">
        </div>
        <div v-if="showGradients" :style="{ opacity: bottomGradientOpacity }"
            class="absolute bottom-0 left-0 right-0 h-[100px] bg-gradient-to-t from-[#0b0b0b] to-transparent pointer-events-none transition-opacity duration-300 ease">
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, useTemplateRef, nextTick } from 'vue';
import { gsap } from 'gsap';

interface AnimatedListProps {
    items?: string[];
    showGradients?: boolean;
    enableArrowNavigation?: boolean;
    className?: string;
    itemClassName?: string;
    displayScrollbar?: boolean;
    initialSelectedIndex?: number;
    slotData?: Record<string, any>[];
}

const props = withDefaults(defineProps<AnimatedListProps>(), {
    items: () => [
        'Item 1',
        'Item 2',
        'Item 3',
        'Item 4',
        'Item 5',
        'Item 6',
        'Item 7',
        'Item 8',
        'Item 9',
        'Item 10',
        'Item 11',
        'Item 12',
        'Item 13',
        'Item 14',
        'Item 15'
    ],
    showGradients: true,
    enableArrowNavigation: true,
    className: '',
    itemClassName: '',
    displayScrollbar: true,
    initialSelectedIndex: -1,
    slotData: () => [],
});

const emit = defineEmits<{
    itemSelected: [item: string, index: number];
}>();

// refs
const containerRef = useTemplateRef<HTMLDivElement>('containerRef');
const listRef = useTemplateRef<HTMLDivElement>('listRef');
const itemRefs = ref<HTMLElement[]>([]);

// reactive state
const selectedIndex = ref(props.initialSelectedIndex);
const keyboardNav = ref(false);
const topGradientOpacity = ref(0);
const bottomGradientOpacity = ref(1);
const itemsInView = ref<boolean[]>(new Array(props.items.length).fill(false));

// methods
const setSelectedIndex = (index: number) => {
    selectedIndex.value = index;
};

const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    topGradientOpacity.value = Math.min(scrollTop / 50, 1);
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    bottomGradientOpacity.value = scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1);

    updateItemsInView();
};

const updateItemsInView = () => {
    if (!listRef.value) return;

    const maxheight = containerRef.value?.getBoundingClientRect().height;
    const container = listRef.value;
    container.style.maxHeight = `${maxheight}px`;
    const containerRect = container.getBoundingClientRect();

    const newItemsInView = props.items.map((_, index) => {
        const item = container.querySelector(`[data-index="${index}"]`) as HTMLElement;
        if (!item) return false;

        const itemRect = item.getBoundingClientRect();
        const viewHeight = containerRect.height;
        const itemTop = itemRect.top - containerRect.top;
        const itemBottom = itemTop + itemRect.height;

        return itemTop < viewHeight && itemBottom > 0;
    });

    newItemsInView.forEach((inView, index) => {
        if (inView && !itemsInView.value[index]) {
            const el = itemRefs.value[index];
            if (el) {
                gsap.fromTo(
                    el,
                    { scale: 0.7, opacity: 0 },
                    { scale: 1, opacity: 1, duration: 0.2, delay: 0.1, ease: 'power2.out' }
                );
            }
        }
    });

    itemsInView.value = newItemsInView;
};

const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        keyboardNav.value = true;
        setSelectedIndex(Math.min(selectedIndex.value + 1, props.items.length - 1));
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        keyboardNav.value = true;
        setSelectedIndex(Math.max(selectedIndex.value - 1, 0));
    } else if (e.key === 'Enter') {
        if (selectedIndex.value >= 0 && selectedIndex.value < props.items.length) {
            e.preventDefault();
            emit('itemSelected', props.items[selectedIndex.value] || '', selectedIndex.value);
        }
    }
};

// 监听选中项变化，自动滚动到可视区域
watch([selectedIndex, keyboardNav], () => {
    if (!keyboardNav.value || selectedIndex.value < 0 || !listRef.value) return;
    const container = listRef.value;
    const selectedItem = container.querySelector(`[data-index="${selectedIndex.value}"]`) as HTMLElement | null;
    if (selectedItem) {
        const extraMargin = 50;
        const containerScrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const itemTop = selectedItem.offsetTop;
        const itemBottom = itemTop + selectedItem.offsetHeight;
        if (itemTop < containerScrollTop + extraMargin) {
            container.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' });
        } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
            container.scrollTo({
                top: itemBottom - containerHeight + extraMargin,
                behavior: 'smooth'
            });
        }
    }
    keyboardNav.value = false;
});

watch(() => [props.items, props.slotData], () => {
    nextTick(() => {
        updateItemsInView();
    })
}, { deep: true });

// 生命周期
onMounted(() => {
    if (props.enableArrowNavigation) {
        window.addEventListener('keydown', handleKeyDown);
    }

    // 初始检测视口并触发动画
    nextTick(() => {
        updateItemsInView();
    });
});

onUnmounted(() => {
    if (props.enableArrowNavigation) {
        window.removeEventListener('keydown', handleKeyDown);
    }
});
</script>