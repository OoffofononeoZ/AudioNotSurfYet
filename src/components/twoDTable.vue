<template>
    <main>
        <canvas ref="canvasRef"></canvas>
    </main>

</template>

<script setup lang="ts">

const props = defineProps<{
    data?: Array<number>,
}>();
const tempData: Array<number> = (() => {
    const data = [];
    for (let i = 0; i < 1024; i++) {
        data.push(Math.random() * 100);
    }
    return data;
})();
console.log(tempData);
</script>