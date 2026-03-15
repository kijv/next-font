import { builtinModules } from 'node:module'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: 'vp pack --minify',
        passThroughEnvs: ['CI', 'GITHUB_ACTIONS'],
      },
      dev: {
        command: 'vp pack --watch --sourcemap',
        cache: false,
      },
    },
  },
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
})
