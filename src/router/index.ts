import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '../layouts/MainLayout.vue';
import Home from '../views/Home.vue';
import TestLands from '../views/TestLands.vue';
import ComingSoon from '../views/ComingSoon.vue';
import Analyzer from '../views/Analyzer.vue';
import Editor from '../views/Editor.vue';
import Visualizer from '../views/Visualizer.vue';
import VisualizerDisplay from '../views/VisualizerDisplay.vue';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '',
            component: MainLayout,
            children: [
                {
                    path: 'display/:styleId',
                    name: 'visualizer-display',
                    component: VisualizerDisplay,
                    meta: { presentation: true },
                },
                {
                    path: '',
                    component: Home,
                },
                {
                    path: 'comingsoon',
                    component: ComingSoon,
                },
                {
                    path: 'analyzer',
                    component: Analyzer,
                },
                {
                    path: 'visualizer/:trackId?',
                    name: 'visualizer',
                    component: Visualizer,
                },
                {
                    path: 'editor/:trackId?',
                    name: 'editor',
                    component: Editor,
                },
                {
                    path: 'testlands',
                    component: TestLands,
                },
            ],
        },
    ],
});

export default router;
