<template>
    <main class="w-full h-dvh bg-black">
        <Header />
        <router-view />
    </main>
</template>

<script setup lang="ts">
import Header from '../components/Header.vue';
</script>