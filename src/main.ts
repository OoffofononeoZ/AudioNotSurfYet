import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from './router';
import { createPinia } from 'pinia';
import persistedstate from 'pinia-plugin-persistedstate';
import 'element-plus/dist/index.css';

const pinia = createPinia();
pinia.use(persistedstate);

const app = createApp(App);
app.use(pinia);
app.use(router).mount('#app');