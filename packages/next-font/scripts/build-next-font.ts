import assert from 'node:assert'
import path from 'node:path'
import { type BundleConfig, bundle } from 'bunchee'
import glob from 'fast-glob'

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
