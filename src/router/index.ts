import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '../layouts/MainLayout.vue';
import Home from '../views/Home.vue';
import TestLands from '../views/TestLands.vue';
import ComingSoon from '../views/ComingSoon.vue';

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
                    path: 'comingsoon',
                    component: ComingSoon,
                },
                {
                    path: 'testlands',
                    component: TestLands,
                },
            ],
        }
    ],
});

export default router;