import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { processingFixturePlugin } from './tests/processing/vitePlugin'
import { transcriptionFixturePlugin } from './tests/transcription/vitePlugin'

// https://vite.dev/config/
export default defineConfig({
  server: {
    watch: { ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright-report/**', '**/trash/**'] },
  },
  plugins: [
    processingFixturePlugin(),
    transcriptionFixturePlugin(),
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
})
