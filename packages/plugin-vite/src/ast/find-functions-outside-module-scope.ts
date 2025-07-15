import type * as acorn from 'acorn'
import { walk } from 'estree-walker'
import type { ProgramNode, State } from './transform'

export class FindFunctionsOutsideModuleScope {
  state: State

  constructor({ state }: { state: State }) {
    this.state = state
  }

  visit(ast: ProgramNode) {
    walk(ast, {
      enter: (node) => {
        if (node.type === 'Identifier') {
          this.visitIdent(node as acorn.Identifier)
        }
      },
    })
  }

  visitIdent(ident: acorn.Identifier) {
    if (
      ident.name in this.state.fontFunctions &&
      !this.state.fontFunctionsInAllowedScope.includes(ident.start)
    ) {
      throw new Error('Font loaders must be called and assigned to a const in the module scope')
    }
  }
}
