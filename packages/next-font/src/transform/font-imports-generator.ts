import type * as ESTree from 'estree'
import type { CallExpression, Literal } from 'estree'
import type { Expression, ObjectExpression, Program } from 'oxc-parser'
import type { FontExport, FontImport, RemovableModuleItem } from '.'
import { walk } from 'estree-walker'

interface FontFunction {
  loader: string
  functionName?: string
}

interface State {
  fontFunctions: Map<string, FontFunction>
  removableModuleItems: Set<RemovableModuleItem>
  fontImports: FontImport[]
  fontExports: FontExport[]
  fontFunctionsInAllowedScope: Set<ESTree.Node>
}

export class FontImportsGenerator {
  state: State
  relativePath: string

  constructor(state: State, relativePath: string) {
    this.state = state
    this.relativePath = relativePath
  }

  checkCallExpr(
    callExpr: CallExpression,
    variableName?: ESTree.Identifier
  ): ESTree.ImportDeclaration | null {
    if (callExpr.callee.type !== 'Identifier') return null
    const identName = callExpr.callee.name
    const fontFunction = this.state.fontFunctions.get(identName)
    if (!fontFunction) return null

    this.state.fontFunctionsInAllowedScope.add(callExpr.callee)

    const argsJson: any[] = callExpr.arguments.map((arg) => {
      if (arg.type === 'SpreadElement') {
        throw new Error("Font loaders don't accept spreads")
      }
      return exprToJson(arg as Expression)
    })

    const functionName = fontFunction.functionName ?? ''
    const queryJson = {
      path: this.relativePath,
      import: functionName,
      arguments: argsJson,
      variableName: variableName?.name,
    }

    const importDecl: ESTree.ImportDeclaration = {
      type: 'ImportDeclaration',
      specifiers: [],
      attributes: [],
      source: {
        type: 'Literal',
        value: `${fontFunction.loader}/target.css?${JSON.stringify(queryJson)}`,
        raw: `'${fontFunction.loader}/target.css?${JSON.stringify(queryJson)}'`,
      } as Literal,
    }

    return importDecl
  }

  checkVarDecl(varDecl: ESTree.VariableDeclaration): ESTree.Identifier | null {
    const decl = varDecl.declarations[0]
    if (!decl || !decl.id || !decl.init) return null

    let ident: ESTree.Identifier
    if (decl.id.type === 'Identifier') {
      ident = decl.id
    } else {
      return null
    }

    if (decl.init.type !== 'CallExpression') return null

    const importDecl = this.checkCallExpr(decl.init, ident)
    if (!importDecl) return null

    if (varDecl.kind !== 'const') {
      throw new Error('Font loader calls must be assigned to a const')
    }

    importDecl.specifiers = [
      {
        type: 'ImportDefaultSpecifier',
        local: ident,
      },
    ]

    this.state.fontImports.push(importDecl as any)
    return ident
  }

  visitModule(ast: Program): void {
    walk(ast as any, {
      enter: (node, parent) => {
        // Standalone variable declarations in module scope
        if (node.type === 'VariableDeclaration') {
          // Avoid processing the same declaration twice when it's part of
          // an `export const` (handled in the ExportNamedDeclaration branch).
          if (parent && parent.type === 'ExportNamedDeclaration') return

          if (this.checkVarDecl(node)) {
            this.state.removableModuleItems.add(node)
          }
        }

        // `export const foo = Font()` declarations
        if (
          node.type === 'ExportNamedDeclaration' &&
          node.declaration?.type === 'VariableDeclaration'
        ) {
          const ident = this.checkVarDecl(node.declaration)
          if (ident) {
            this.state.removableModuleItems.add(node)
            this.state.fontExports.push({
              type: 'ExportNamedDeclaration',
              declaration: null,
              specifiers: [
                {
                  type: 'ExportSpecifier',
                  local: ident,
                  exported: ident,
                },
              ],
              source: null,
            } as any)
          }
        }
      },
    })
  }
}

export function generateFontImports(
  ast: Program,
  relativePath: string,
  state: State
) {
  const generator = new FontImportsGenerator(state, relativePath)
  generator.visitModule(ast)
}

const exprToJson = (expr: Expression): any => {
  switch (expr.type) {
    case 'Literal':
      return expr.value
    case 'ObjectExpression':
      return objectLitToJson(expr)
    case 'ArrayExpression': {
      const elements = expr.elements.map((e) => {
        if (e) {
          if (e.type === 'SpreadElement') throw new Error('Unexpected spread')
          return exprToJson(e)
        } else {
          throw new Error('Unexpected empty value in array')
        }
      })

      return elements
    }
    default:
      throw new Error('Font loader values must be explicitly written literals.')
  }
}

const objectLitToJson = (objectLit: ObjectExpression): any => {
  const values: Record<string, any> = {}

  for (const prop of objectLit.properties) {
    if (prop.type === 'SpreadElement') throw new Error('Unexpected spread')

    if (prop.kind !== 'init') throw new Error('Unexpected key')

    if (prop.key.type !== 'Identifier')
      throw new Error('Unexpected object key type')

    values[prop.key.name] = exprToJson(prop.value)
  }

  return values
}
