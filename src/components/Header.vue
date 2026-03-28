<template>
    <header class="w-full h-16 bg-transparent fixed top-0 left-0 z-50" id="main-header">
        <section class="min-w-32">
            <router-link to="/" class="text-white font-bold text-2xl">AUDIOSURF</router-link>
        </section>
        <section class="flex gap-4">
            <router-link to="/comingsoon" class="text-white">Visualizer</router-link>
            <router-link to="/comingsoon" class="text-white">Analyzer</router-link>
            <router-link to="/comingsoon" class="text-white">Editor</router-link>
            <router-link to="/testlands" class="text-white">TestLands</router-link>
        </section>
        <section class="min-w-32">

        </section>
    </header>
</template>

<script setup lang="ts">

</script>
<style scoped>
#main-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
}
#main-header::before {
    content: "";
    position: absolute;
    width: 100%;
    height: 1px;
    top: 100%;
    left: 0;
    background: linear-gradient(90deg, #0000, var(--main-color), #0000);
    pointer-events: none;
    z-index: 1;
}
</style>