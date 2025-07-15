import path from 'node:path'
import { type BundleConfig, bundle } from 'bunchee'
import glob from 'fast-glob'

const cwd = path.join(import.meta.dirname, '..')
const config: BundleConfig = {
  minify: true,
  tsconfig: path.join(cwd, 'tsconfig.json'),
  external: [
    '../next-font-error.js',
    // google
    './validate-google-font-function-call.js',
    './fetch-css-from-google-fonts.js',
    './fetch-font-file.js',
    './find-font-files-in-css.js',
    './get-fallback-font-override-metrics.js',
    './get-font-axes.js',
    './get-google-fonts-url.js',
    // local
    './get-fallback-metrics-from-font-file.js',
    './pick-font-file-for-fallback-generation.js',
    './validate-local-font-function-call.js',
  ],
}

const distDir = path.join(cwd, 'dist')

const files = await glob(['src/{google,local}/loader.ts', 'src/{fontkit,index}.ts'], {
  cwd,
})

const exports = Object.fromEntries(
  files.map((file) => {
    const noSrc = path.relative('src', file)
    const ext = (ext: string) => path.join(path.join(distDir, noSrc.replace(/\.ts$/, ext)))

    return [
      `./${noSrc.replace(/\.ts$/, '')}`,
      {
        import: ext('.js'),
        types: ext('.d.ts'),
      },
    ]
  })
)

const start = performance.now()
await bundle(
  '',
  Object.assign({}, config, {
    cwd,
    pkg: {
      types: undefined,
      exports,
    },
    _callbacks: {
      async onBuildEnd() {
        console.log(`Built fonkit and @next/font loaders [${performance.now() - start}ms]`)
      },
    },
  })
)
