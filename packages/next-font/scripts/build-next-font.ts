import assert from 'node:assert'
import path from 'node:path'
import { type BundleConfig, bundle } from 'bunchee'
import glob from 'fast-glob'

const cwd = path.join(import.meta.dirname, '..')
const config: BundleConfig = {
  minify: true,
  tsconfig: path.join(cwd, 'tsconfig.json'),
}

console.log(cwd);

const nextFontDir = Bun.fileURLToPath(
  path.dirname(import.meta.resolve('@vercel/next.js/packages/font/package.json'))
)
assert.equal(await Bun.file(nextFontDir).exists(), true)
const distDir = path.join(cwd, 'dist')

const files = (
  await glob('src/**/*.ts', {
    cwd: nextFontDir,
    ignore: ['src/**/*.test.ts'],
  })
).filter((file) => !path.basename(file).startsWith('loader'))

const exports = Object.fromEntries(
  files.map((file) => {
    const noSrc = path.relative('src', file)
    const ext = (ext: string) =>
      path.join(path.relative(nextFontDir, path.join(distDir, noSrc.replace(/\.ts$/, ext))))

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
    cwd: nextFontDir,
    pkg: {
      types: undefined,
      exports,
    },
    _callbacks: {
      async onBuildEnd() {
        console.log(`Built @next/font [${performance.now() - start}ms]`)
      },
    },
  })
)
