import { builtinModules } from 'node:module'
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
    entry: 'src/index.ts',
    dts: {
      oxc: true,
    },
    shims: true,
    treeshake: {
      moduleSideEffects: false,
    },
    deps: {
      neverBundle: ['rolldown'].concat(
        builtinModules.concat(builtinModules.map((mod) => `node:${mod}`))
      ),
      onlyAllowBundle: [
        '@rolldown/pluginutils',
        'esrap',
        'stable-hash',
        'next',
        'estree-walker',
      ],
    },
  },
})
