import path from 'node:path'
import type * as acorn from 'acorn'
import { walk } from 'estree-walker'
import queryString from 'query-string'
import stableHash from 'stable-hash'
import { DUMMY_SP } from '../constants'
import type { FontImportDataQuery, ProgramNode, State } from './transform'
import { exprToJson } from './utils'

export class FontImportsGenerator {
  state: State
  id: string
  remapImports: Record<string, string | undefined>

  constructor({
    state,
    id,
    remapImports,
  }: {
    state: typeof FontImportsGenerator.prototype.state
    id: typeof FontImportsGenerator.prototype.id
    remapImports: typeof FontImportsGenerator.prototype.remapImports
  }) {
    this.state = state
    this.id = id
    this.remapImports = remapImports
  }

  visit(ast: ProgramNode) {
    walk(ast, {
      enter: (node) => {
        if (node.type === 'VariableDeclaration') {
          this.checkVarDecl(node as acorn.VariableDeclaration)
        }
        if (node.type === 'VariableDeclaration') {
          if (this.checkVarDecl(node as acorn.VariableDeclaration) != null)
            this.state.removeableModuleItems.push((node as acorn.VariableDeclaration).start)
        }
        if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
          const exportDecl = node as acorn.ExportNamedDeclaration | acorn.ExportDefaultDeclaration

          if (exportDecl.declaration?.type === 'VariableDeclaration') {
            const varDecl = exportDecl.declaration as acorn.VariableDeclaration
            const ident = this.checkVarDecl(varDecl)
            if (ident) {
              this.state.removeableModuleItems.push(exportDecl.start)

              this.state.fontExports.push({
                type: 'ExportNamedDeclaration',
                specifiers: [
                  {
                    type: 'ExportSpecifier',
                    local: ident,
                    exported: {
                      name: ident.name,
                      type: 'Identifier',
                      ...DUMMY_SP,
                    },
                    ...DUMMY_SP,
                  },
                ],
                attributes: [],
                ...DUMMY_SP,
              } satisfies acorn.ExportNamedDeclaration)
            }
          }
        }
      },
    })
  }

  checkVarDecl(varDecl: acorn.VariableDeclaration) {
    const decl = varDecl.declarations[0]
    const ident = decl?.id as acorn.Identifier | undefined
    const expr = decl?.init

    if (expr?.type === 'CallExpression') {
      const callExpr = expr as acorn.CallExpression
      const importDecl = this.checkCallExpr(callExpr, ident)

      if (importDecl) {
        if (varDecl.kind !== 'const')
          throw new Error('Font loader calls must be assigned to a const')
        if (!ident) throw new Error('Font loader calls must be assigned to an identifier')

        importDecl.specifiers = [
          {
            type: 'ImportDefaultSpecifier',
            local: ident,
            ...DUMMY_SP,
          } satisfies acorn.ImportDefaultSpecifier,
        ]

        if (!this.state.fontImports.map(stableHash).includes(stableHash(importDecl))) {
          // @ts-expect-error
          this.state.fontImports.push(importDecl)
        }

        return ident
      }
    }
  }

  checkCallExpr(callExpr: acorn.CallExpression, variableName?: acorn.Identifier) {
    if (callExpr.callee.type === 'Identifier') {
      const ident = callExpr.callee as acorn.Identifier
      const fontFunction = this.state.fontFunctions[ident.name]

      if (fontFunction) {
        this.state.fontFunctionsInAllowedScope.push(ident.start)
        const json = callExpr.arguments.map((expr_or_spread) => {
          if (expr_or_spread.type === 'SpreadElement')
            throw new Error("Font loaders don't accept spreads")

          return exprToJson(expr_or_spread)
        })

        const functionName = fontFunction.functionName ?? ''
        const queryJson = {
          path: this.id,
          import: functionName,
          arguments: json,
          variableName: variableName?.name ?? '',
        } satisfies FontImportDataQuery

        return {
          type: 'ImportDeclaration',
          source: {
            type: 'Literal',
            value: queryString.stringifyUrl({
              url: path.posix.join(
                this.remapImports[fontFunction.loader] || fontFunction.loader,
                'target.css'
              ),
              query: Object.assign({}, queryJson, {
                arguments: JSON.stringify(queryJson.arguments),
              }),
            }),
            ...DUMMY_SP,
          },
          specifiers: [],
          attributes: [],
          ...DUMMY_SP,
        } as acorn.ImportDeclaration
      }
    }
  }
}
