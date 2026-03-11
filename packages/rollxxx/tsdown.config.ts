import { defineConfig } from 'vite-plus/pack'

export default defineConfig({
  platform: 'node',
  entry: './src/index.ts',
  dts: {
    oxc: true,
  },
  shims: true,
  inputOptions: {
    resolve: {
      alias: {
        'vite-rolldown': 'vite',
      },
    },
  },
  deps: {
    neverBundle: ['rolldown', 'rollup'],
    onlyAllowBundle: ['picomatch', '@rolldown/pluginutils'],
  },
})
