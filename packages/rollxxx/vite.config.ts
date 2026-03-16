import { defineConfig } from 'vite-plus'

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: 'vp pack --minify',
        untrackedEnv: ['CI', 'GITHUB_ACTIONS'],
      },
      dev: {
        command: 'vp --watch --sourcemap',
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
      onlyBundle: ['picomatch', '@rolldown/pluginutils'],
    },
  },
})
