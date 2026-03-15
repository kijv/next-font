import { builtinModules } from 'node:module'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: [
    {
      publint: true,
      platform: 'node',
      entry: ['src/{local,manifest}.ts', 'src/google/index.ts'],
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
  ],
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
