import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '../layouts/MainLayout.vue';
import Home from '../views/Home.vue';
import TestLands from '../views/TestLands.vue';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '',
            component: MainLayout,
            children: [
                {
                    path: '',
                    component: Home,
                },
                {
                    path: 'testlands',
                    component: TestLands,
                },
            ],
        },
        {
            path: '/',
            redirect: '',
        }
    ],
});

export default router;