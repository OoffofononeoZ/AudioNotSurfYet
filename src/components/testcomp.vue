<template>
    <div class="mt-16">
        <input type="range" min="400" max="1200" v-model="containerWidth" />
        <p class="text-white">容器宽度: {{ containerWidth }}</p>

        <div :style="{
            display: 'flex',
            gap: columnGap + 'px',
        }">
            <div v-for="(col, i) in layoutedCards" :key="i" :style="{ width: columnWidth + 'px' }">
                <div v-for="item in col.items" :key="item.id" :style="{
                    marginBottom: columnGap + 'px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: '#fff'
                }">
                    <!-- 图片 -->
                    <div :style="{
                        height: item.imageHeight + 'px',
                        background: '#ccc'
                    }"></div>

                    <!-- 文本 -->
                    <div style="padding: 8px; font-size: 14px; line-height: 20px;">
                        {{ item.text }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { prepare, layout } from '@chenglou/pretext'

type Card = {
    id: number
    text: string
    imageHeight: number
}

// 模拟数据
const cards = ref<Card[]>([
    { id: 1, text: '短文本', imageHeight: 120 },
    { id: 2, text: '这是一段稍微长一点的文本，用来测试换行效果', imageHeight: 180 },
    { id: 3, text: 'AGI 春天到了 🚀 多语言支持很好', imageHeight: 140 },
    { id: 4, text: '更长更长更长更长更长更长更长的文本测试一下布局是否稳定', imageHeight: 200 },
    { id: 5, text: 'Vue + Pretext 瀑布流', imageHeight: 160 },
])

const containerWidth = ref(800)
const columnGap = 12
const columnWidth = 240
const lineHeight = 20

// 预处理缓存（每个卡片一个）
const preparedMap = new Map<number, any>()

onMounted(() => {
    cards.value.forEach(card => {
        preparedMap.set(
            card.id,
            prepare(card.text, '14px Inter')
        )
    })
})

// 计算列数
const columnCount = computed(() => {
    const count = Math.floor(
        (Number(containerWidth.value) + columnGap) / (columnWidth + columnGap)
    )
    return Math.max(1, Math.min(count, cards.value.length))
})

// 瀑布流布局
const layoutedCards = computed(() => {
    const cols = Array.from({ length: columnCount.value }, () => ({
        height: 0,
        items: [] as any[]
    }))

    cards.value.forEach(card => {
        let prepared = preparedMap.get(card.id)
        if (!prepared) {
            prepared = prepare(card.text, '14px Inter')
            preparedMap.set(card.id, prepared)
        };

        const textHeight = layout(
            prepared,
            columnWidth - 16, // padding
            lineHeight
        ).height

        const totalHeight = card.imageHeight + textHeight + 32 // padding + margin

        // 找最短列
        let minCol = cols[0]
        for (const col of cols) {
            if (col.height < minCol!.height) {
                minCol = col
            }
        }

        minCol!.items.push({
            ...card,
            height: totalHeight
        })

        minCol!.height += totalHeight + columnGap
    })

    return cols.filter(col => col.items.length > 0)
})
</script>