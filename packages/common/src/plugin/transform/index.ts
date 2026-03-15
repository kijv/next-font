import type * as Acorn from 'acorn'
import type * as ESTree from 'estree'
import type {
  ExportAllDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ImportDeclaration,
  Program,
  Statement,
} from 'oxc-parser'
import { collectFontFunctions } from './font-function-collector'
import { findFunctionsOutsideModuleScope } from './find-functions-outside-module-scope'
import { generateFontImports } from './font-imports-generator'

export interface Config {
  fontLoaders: string[]
  relativeFilePathFromRoot: string
}

interface FontFunction {
  loader: string
  functionName?: string
}

export type RemovableModuleItem =
  | ESTree.ModuleDeclaration
  | ESTree.Statement
  | Acorn.Statement
  | Acorn.ModuleDeclaration
  | Statement
export type FontImport =
  | ESTree.ImportDeclaration
  | Acorn.ImportDeclaration
  | ImportDeclaration
export type FontExport =
  | Acorn.ExportAllDeclaration
  | Acorn.ExportDefaultDeclaration
  | Acorn.ExportNamedDeclaration
  | ExportAllDeclaration
  | ExportDefaultDeclaration
  | ExportNamedDeclaration

interface State {
  fontFunctions: Map<string, FontFunction>
  removableModuleItems: Set<RemovableModuleItem>
  fontImports: FontImport[]
  fontExports: FontExport[]
  fontFunctionsInAllowedScope: Set<ESTree.Node>
}

const createState = (): State => ({
  fontFunctions: new Map(),
  removableModuleItems: new Set(),
  fontImports: [],
  fontExports: [],
  fontFunctionsInAllowedScope: new Set(),
})

export const nextFontLoaders =
  (config: Config) =>
  (
    ast: Program
  ): {
    fontImports: string[]
  } | null => {
    const state = createState()

    collectFontFunctions(ast, config.fontLoaders, state)

    if (state.removableModuleItems.size === 0) return null

    generateFontImports(ast, config.relativeFilePathFromRoot, state)

    findFunctionsOutsideModuleScope(ast, state)

    const firstRemovableIndex = ast.body.findIndex((stmt) =>
      state.removableModuleItems.has(stmt)
    )

    ast.body = ast.body.filter((stmt) => !state.removableModuleItems.has(stmt))

    if (firstRemovableIndex >= 0) {
      ast.body.splice(
        firstRemovableIndex,
        0,
        ...(state.fontImports as ImportDeclaration[])
      )
    }

    ast.body.push(
      ...(state.fontExports as (
        | ExportAllDeclaration
        | ExportDefaultDeclaration
        | ExportNamedDeclaration
      )[])
    )

    return {
      fontImports: state.fontImports
        .map((fontImport) => fontImport.specifiers[0]?.local.name)
        .filter(Boolean) as string[],
    }
  }
