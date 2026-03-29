<template>
    <main class="w-dvw h-dvh bg-black" id="main-layout">
        <HeaderBar />
        <router-view />
        <MusicBar :progress="0" />
    </main>
</template>

<script setup lang="ts">
import HeaderBar from '../components/HeaderBar.vue';
import MusicBar from '../components/MusicBar.vue';
</script>

<style scoped>

</style>