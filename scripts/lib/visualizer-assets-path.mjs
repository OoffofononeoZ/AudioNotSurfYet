import { resolve } from 'node:path';
export const visualizerAssetsPath = () =>
    resolve(process.env.VISUALIZER_ASSETS_DIR ?? resolve(import.meta.dirname, '../../../WheresYourElements/assets'));
