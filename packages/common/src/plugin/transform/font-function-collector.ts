import type * as ESTree from 'estree'
import type { Program } from 'oxc-parser'
import type { RemovableModuleItem } from '.'
import { walk } from 'estree-walker'

interface FontFunction {
  loader: string
  functionName?: string
}

interface State {
  fontFunctions: Map<string, FontFunction>
  removableModuleItems: Set<RemovableModuleItem>
  fontFunctionsInAllowedScope: Set<ESTree.Node>
}

export const collectFontFunctions = (
  ast: Program,
  fontLoaders: string[],
  state: State
): void => {
  walk(ast as any, {
    enter(node: ESTree.Node) {
      if (node.type !== 'ImportDeclaration') return

      const source = (node.source as ESTree.Literal).value as string
      if (!fontLoaders.includes(source)) return

      state.removableModuleItems.add(node)

      for (const specifier of node.specifiers) {
        if (specifier.type === 'ImportNamespaceSpecifier') {
          throw new Error("Font loaders can't have namespace imports")
        }

        const localName = specifier.local.name

        let functionName: string | undefined

        if (specifier.type === 'ImportSpecifier') {
          functionName =
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : undefined
        }

        state.fontFunctionsInAllowedScope.add(specifier.local)

        state.fontFunctions.set(localName, {
          loader: source,
          functionName,
        })
      }
    },
  })
}
