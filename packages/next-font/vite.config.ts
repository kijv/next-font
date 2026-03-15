import { defineConfig } from 'vite-plus'
import { builtinModules } from 'node:module'

export default defineConfig({
  pack: [
    {
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
        alwaysBundle: ['fontkit'],
        onlyAllowBundle: [],
      },
      plugins: [
        {
          name: 'next-font-font-data-json',
          async generateBundle() {
            this.emitFile({
              type: 'asset',
              fileName: 'google/font-data.json',
              source: JSON.stringify(
                await import('./src/google/font-data.json').then(
                  (m) => m.default
                )
              ),
            })
          },
        },
      ],
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
