import type estree from 'estree';
import { walk } from 'estree-walker';
import type { parseAst } from 'vite';
import { FindFunctionsOutsideModuleScope } from './find-functions-outside-module-scope';
import { FontFunctionsCollector } from './font-functions-collector';
import { FontImportsGenerator } from './font-imports-generator';

export interface FontImportDataQuery {
  path: string;
  import: string;
  arguments: any[];
  variableName: string;
}

export interface State {
  removeableModuleItems: number[];
  fontFunctionsInAllowedScope: number[];
  fontFunctions: Record<
    string,
    {
      loader: string;
      functionName?: string;
      imported?: true;
    }
  >;
  fontImports: estree.ModuleDeclaration[];
  fontExports: estree.ModuleDeclaration[];
}

export type ProgramNode = ReturnType<typeof parseAst>;
export const visit = ({
  ast,
  fontLoaders,
  id,
  remapImports,
}: {
  ast: ReturnType<typeof parseAst>;
  fontLoaders: string[];
  remapImports: Record<string, string | undefined>;
  id: string;
}) => {
  const state = new Proxy(
    {
      removeableModuleItems: [],
      fontFunctionsInAllowedScope: [],
      fontFunctions: {},
      fontImports: [],
      fontExports: [],
    } as State,
    {
      set(target, prop, value) {
        target[prop as keyof State] = value;
        return true;
      },
      get(target, prop) {
        return target[prop as keyof State];
      },
    },
  );
  const functionsCollector = new FontFunctionsCollector({
    state,
    fontLoaders,
    remapImports,
  });
  functionsCollector.visit(ast);

  if (state.removeableModuleItems.length > 0) {
    const importGenerator = new FontImportsGenerator({
      state,
      id,
      remapImports,
    });
    importGenerator.visit(ast);

    const wrongScope = new FindFunctionsOutsideModuleScope({ state });
    wrongScope.visit(ast);

    const isRemovable = <T extends { start: number }>(node: T) => {
      return state.removeableModuleItems.includes(node.start);
    };

    // @ts-expect-error
    const firstRemovableIndex = ast.body.findIndex(isRemovable);

    // Remove marked module items
    walk(ast as import('estree-walker').Node, {
      enter(node) {
        // @ts-expect-error
        if (isRemovable(node)) this.remove();
      },
    });

    // Add font imports and exports
    ast.body.splice(firstRemovableIndex, 0, ...state.fontImports);
    ast.body.push(...state.fontExports);

    return {
      changed: true,
      state,
    };
  }

  return {
    changed: false,
    state,
  };
};
