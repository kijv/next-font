import type * as acorn from 'acorn'
import { walk } from 'estree-walker'
import { isSamePath, removeQuerySuffix } from '../utils'
import type { ProgramNode, State } from './transform'

export class FontFunctionsCollector {
  state: State
  fontLoaders: string[]
  remapImports: Record<string, string | undefined>

  constructor({
    state,
    fontLoaders,
    remapImports,
  }: {
    state: State
    fontLoaders: string[]
    remapImports: Record<string, string | undefined>
  }) {
    this.state = state
    this.fontLoaders = fontLoaders
    this.remapImports = remapImports
  }

  visit(ast: ProgramNode) {
    walk(ast, {
      enter: (node) => {
        if (node.type === 'ImportDeclaration') {
          this.visitImportDecl(node as acorn.ImportDeclaration)
        }
      },
    })
  }

  visitImportDecl(importDecl: acorn.ImportDeclaration) {
    if (typeof importDecl.source.value !== 'string') return

    let resolvedId: string | null = null

    try {
      resolvedId = import.meta.resolve(
        removeQuerySuffix(this.remapImports[importDecl.source.value] || importDecl.source.value)
      )
    } catch {}

    if (
      resolvedId != null &&
      this.fontLoaders.some((fontLoader) =>
        isSamePath(import.meta.resolve(fontLoader), resolvedId)
      )
    ) {
      this.state.removeableModuleItems.push(importDecl.start)

      for (const specifier of importDecl.specifiers) {
        const { local, functionName } = (() => {
          switch (specifier.type) {
            case 'ImportSpecifier': {
              const { local, imported } = specifier as acorn.ImportSpecifier
              const functionName = imported.type === 'Identifier' ? imported.name : local.name
              return {
                local,
                functionName,
              }
            }
            case 'ImportDefaultSpecifier': {
              const { local } = specifier as acorn.ImportDefaultSpecifier
              return {
                local,
              }
            }
            case 'ImportNamespaceSpecifier': {
              throw new Error("Font loaders can't have namespace imports")
            }
          }
        })()

        this.state.fontFunctionsInAllowedScope.push(local.start)
        this.state.fontFunctions[local.name] = {
          functionName,
          loader: importDecl.source.value,
        }
      }
    }
  }
}
