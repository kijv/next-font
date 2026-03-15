import { builtinModules } from 'node:module'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    publint: true,
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
  lint: {
    // @ts-expect-error
    extends: ['../../.oxlintrc.json'],
    categories: {
      correctness: 'warn',
    },
    rules: {
      'eslint/no-unused-vars': 'error',
      'eslint/no-console': [
        'error',
        {
          allow: ['error', 'warn'],
        },
      ],
    },
  },
})
