import type * as ESTree from 'estree'
import type { Program } from 'oxc-parser'
import stableHash from 'stable-hash'
import { walk } from 'estree-walker'

interface State {
  fontFunctions: Map<string, unknown>
  fontFunctionsInAllowedScope: Set<ESTree.Node>
}

export const findFunctionsOutsideModuleScope = (
  ast: Program,
  state: State
): void => {
  walk(ast as any, {
    enter(node: ESTree.Node) {
      if (node.type !== 'Identifier') return

      if (!state.fontFunctions.has(node.name)) return

      if (
        !Array.from(state.fontFunctionsInAllowedScope)
          .map(stableHash)
          .some((hash) => hash === stableHash(node))
      ) {
        throw new Error(
          'Font loaders must be called and assigned to a const in the module scope'
        )
      }
    },
  })
}
