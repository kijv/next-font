import { builtinModules } from 'node:module'
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
    entry: ['src/index.ts'],
    dts: {
      oxc: true,
    },
    shims: true,
    treeshake: {
      moduleSideEffects: false,
    },
    deps: {
      neverBundle: ([] as string[]).concat(
        builtinModules.concat(builtinModules.map((mod) => `node:${mod}`))
      ),
      alwaysBundle: ['rolldown-plugin-next-font'],
    },
  },
})
