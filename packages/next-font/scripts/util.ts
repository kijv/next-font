import path from 'node:path'

export const isWindows = typeof process !== 'undefined' && process.platform === 'win32'

const windowsSlashRE = /\\/g
export function slash(p: string): string {
  return p.replace(windowsSlashRE, '/')
}

export const toExports = (files: string[], ext: (this: { noSrc: string }, ext: string) => string) =>
  Object.fromEntries(
    files.map((file) => {
      const noSrc = path.relative('src', file)

      const next = ext.bind({
        noSrc,
      })
      const k = noSrc.replace(/\.ts$/, '')
      const i = next('.js')
      const t = next('.d.ts')

      return [
        `./${isWindows ? slash(k) : k}`,
        {
          import: isWindows ? slash(i) : i,
          types: isWindows ? slash(t) : t,
        },
      ]
    })
  )
