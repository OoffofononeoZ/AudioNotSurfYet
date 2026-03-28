import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
if (router && router.options.history) {
    const originalListener = router;
    console.log(originalListener);
}
createApp(App).use(router).mount('#app')
