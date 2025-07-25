import type { PluginOption, ResolvedConfig } from 'vite'
import { createCachedImport, tryCatch } from '@/utils'
import MagicString from 'magic-string'
import type { TargetCss } from '@/declarations'
import path from 'node:path'
import { visit } from '@/ast/transform'

const importEscodegen = createCachedImport(
  () =>
    // @ts-expect-error
    import('escodegen-wallaby') as unknown as Promise<typeof import('escodegen')>
)

type OnFontImportsChanged = (
  id: string,
  newValue: string[],
  previousValue: string[]
) => void | Promise<void>

export const nextFontTransformerPlugin = ({
  fontImports,
  onFontImportsChanged,
}: {
  fontImports: Record<string, TargetCss[]>
  onFontImportsChanged: OnFontImportsChanged
}): PluginOption[] => {
  let config: ResolvedConfig | null = null

  const rewriteNextFontImport = {
    '@next/font/google': 'next-font/google',
    '@next/font/local': 'next-font/local',
    'next/font/google': 'next-font/google',
    'next/font/local': 'next-font/local',
  }
  const importedLoaders = ['next-font/google', 'next-font/local']

  return [
    {
      name: 'next-font:transform',
      async configResolved(resolvedConfig) {
        config = resolvedConfig
      },
      async transform(code, id) {
        if (!/\.(?:j|t)sx?$|\.mjs$/.test(id)) return null

        const parse = async () =>
          this.parse(code, {
            jsx: true,
          })

        const { data: ast, error } = await tryCatch(parse())
        if (error) {
          this.error(error)
        }
        if (!ast) return

        const { changed, state } = visit({
          ast,
          fontLoaders: importedLoaders,
          id: path.relative(config!.root, id),
          remapImports: rewriteNextFontImport,
        })

        if (!changed) return

        const nextFontImports = state.fontImports.map(
          (i) => (i as import('estree').ImportDeclaration).source.value as string
        )

        const previousFontImports = fontImports[id]
        if (previousFontImports) {
          const importsChanged = nextFontImports.some(
            (i) => !previousFontImports.some((p) => p.id === i)
          )
          if (importsChanged) {
            onFontImportsChanged(
              id,
              nextFontImports,
              previousFontImports.map((i) => i.id)
            )
          }
        }

        fontImports[id] = nextFontImports.map((i) => ({
          id: i,
        }))

        const escodegen = await importEscodegen()

        const s = new MagicString('')

        for (const node of ast.body) {
          s.append(escodegen.generate(node))
          s.append('\n')
        }

        return {
          code: s.toString(),
        }
      },
    },
  ]
}
