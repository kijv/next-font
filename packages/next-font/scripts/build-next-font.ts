import { type BundleConfig, bundle } from 'bunchee'
import assert from 'node:assert'
import glob from 'fast-glob'
import path from 'node:path'
import { toExports } from './util'

const cwd = path.join(import.meta.dirname, '..')
const config: BundleConfig = {
  minify: true,
  tsconfig: path.join(cwd, 'tsconfig.json'),
}

const pkgJsonPath = Bun.fileURLToPath(import.meta.resolve('@next/font/package.json'))
const pkgJson = await Bun.file(pkgJsonPath)
assert.equal(await pkgJson.exists(), true)
const pkg = await pkgJson.json()

const nextFontDir = path.dirname(pkgJsonPath)
const distDir = path.join(cwd, 'dist')

const files = (
  await glob('src/**/*.ts', {
    cwd: nextFontDir,
    ignore: ['src/**/*.test.ts'],
  })
).filter((file) => !path.basename(file).startsWith('loader'))

const exports = toExports(files, function (ext) {
  return path.join(path.relative(nextFontDir, path.join(distDir, this.noSrc.replace(/\.ts$/, ext))))
})

const start = performance.now()
await bundle(
  '',
  Object.assign({}, config, {
    pkg: {
      types: undefined,
      exports,
    },
    cwd: nextFontDir,
    _callbacks: {
      async onBuildEnd() {
        console.log(`Built @next/font [${performance.now() - start}ms]`)
        Bun.write(pkgJson, JSON.stringify(pkg, null, 2))
      },
    },
  })
)
