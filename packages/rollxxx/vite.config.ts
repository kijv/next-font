import { defineConfig } from 'vite-plus'

export default defineConfig({
  run: {
    tasks: {
      build: {
        passThroughEnvs: ['CI', 'GITHUB_ACTIONS'],
      },
      dev: {
        cache: false,
      },
    },
  },
  pack: {
    publint: true,
    attw: {
      profile: 'esm-only',
    },
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
  },
})
