<template>
    <header class="w-full h-16 bg-transparent fixed top-0 left-0 z-50 main-header">
        <section>
            <router-link to="/" class="text-white">Home</router-link>
        </section>
        <section>
            <router-link to="/testlands" class="text-white">TestLands</router-link>
        </section>
    </header>
</template>

<script setup lang="ts">

</script>
<style scoped>
.main-header::before {
    content: "";
    position: absolute;
    width: 100%;
    height: 1px;
    top: 100%;
    left: 0;
    background: linear-gradient(90deg, #0000, var(--main-color), #0000);
}
</style>