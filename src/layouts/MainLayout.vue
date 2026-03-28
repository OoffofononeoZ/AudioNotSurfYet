<template>
    <main class="w-full h-dvh bg-black">
        <HeaderBar />
        <router-view />
        <MusicBar />
    </main>
</template>

<script setup lang="ts">
import HeaderBar from '../components/HeaderBar.vue';
import MusicBar from '../components/MusicBar.vue';
</script>