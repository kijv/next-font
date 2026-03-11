import { type Program, parse } from 'oxc-parser'
import { and, id, include, moduleType, not, or } from '@rolldown/pluginutils'
import type { ModuleType, Plugin } from 'rolldown'
import { nextFontLoaders } from '@/transform'
import path from 'node:path'
import { print } from 'esrap'
import ts from 'esrap/languages/ts'
import tsx from 'esrap/languages/tsx'

export const nextFontTransform = ({
  fontLoaders,
}: {
  fontLoaders: string[]
}) => {
  return {
    name: 'next-font-transform',
    transform: {
      filter: [
        include(
          or(
            moduleType('js'),
            moduleType('jsx'),
            and(moduleType('ts'), not(id(/\.d\.ts$/))),
            moduleType('jsx'),
            moduleType('mjs'),
            moduleType('cjs')
          )
        ),
      ],
      async handler(
        code: string,
        id: string,
        meta?:
          | { ast?: Program }
          | { moduleType: ModuleType; ssr?: boolean | undefined }
      ) {
        const ast =
          typeof meta === 'object' && 'ast' in meta && meta.ast != null
            ? structuredClone(meta.ast)
            : (await parse(id, code)).program
        const transformer = nextFontLoaders({
          fontLoaders,
          relativeFilePathFromRoot: path.relative(process.cwd(), id),
        })
        const result = transformer(ast)
        if (!result) return null
        return print(ast, id.endsWith('x') ? tsx() : ts())
      },
    },
  } satisfies Plugin
}
