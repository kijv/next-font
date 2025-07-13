import path from 'node:path';
import MagicString from 'magic-string';
import type { PluginOption, ResolvedConfig } from 'vite';
import { visit } from '@/ast/transform';
import { createCachedImport, tryCatch } from '@/utils';

// @ts-expect-error
const importEscodegen = createCachedImport(() => import('escodegen-wallaby') as unknown as Promise<typeof import('escodegen')>);

export type OnFontImportsChanged = (id: string, newValue: string[]) => void;

export const nextFontTransformerPlugin = ({
  fontImports,
  onFontImportsChanged
}: {
  fontImports: Record<string, string[]>,
  onFontImportsChanged: OnFontImportsChanged,
}): PluginOption[] => {
  let config: ResolvedConfig | null = null;

  const rewriteNextFontImport = {
    '@next/font/google': 'next-font/google',
    '@next/font/local': 'next-font/local',
    'next/font/google': 'next-font/google',
    'next/font/local': 'next-font/local',
  };
  const importedLoaders = ['next-font/google', 'next-font/local'];

  return [
    {
      name: 'next-font:transform',
      async configResolved(resolvedConfig) {
        config = resolvedConfig;
      },
      async transform(code, id) {
        if (!/\.(?:j|t)sx?$|\.mjs$/.test(id)) return null;

        const parse = async () =>
          this.parse(code, {
            jsx: true,
          });

        const { data: ast, error } = await tryCatch(parse());
        if (error) {
          this.error(error);
        }
        if (!ast) return;

        const { changed, state } = visit({
          ast,
          fontLoaders: importedLoaders,
          id: path.relative(config!.root, id),
          remapImports: rewriteNextFontImport,
        });

        if (!changed) return;

        const nextFontImports = state.fontImports.map(
          (i) =>
            (i as import('estree').ImportDeclaration).source.value as string,
        );


        const previousFontImports = fontImports[id];
        if (previousFontImports) {
          const importsChanged = nextFontImports.some(
            (i) => !previousFontImports.includes(i),
          );
          if (importsChanged) {
            onFontImportsChanged(id, nextFontImports);
          }
        }

        fontImports[id] = nextFontImports;

        /*
          const promises: Promise<void>[] = [];
          let fullReload = false;
          let preloadedChanged = false;

          for (const removedFontImport of previousFontImports.filter(
            (i) => !nextFontImports.includes(i),
          )) {
            const querySuffix = getQuerySuffix(removedFontImport);
            const resolvedId = import.meta.resolve(
              removeQuerySuffix(removedFontImport),
            );
            const targetCss = fileURLToPath(resolvedId) + querySuffix;

            const removedFontFiles: string[] = [];

            for (const fontFile of targetCssToFontFile.get(targetCss) ?? []) {
              const { preloaded } = fontFileCache.delete(fontFile);
              preloadedChanged = preloadedChanged || preloaded;
              removedFontFiles.push(fontFile);
            }
            targetCssToFontFile.delete(targetCss);
            targetCssCache.delete(targetCss);

            if (removedFontFiles.length > 0) {
              promises.push(
                (async () => {
                  for (const server of servers) {
                    const targetCssModule =
                      await server.moduleGraph.getModuleById(targetCss);
                    if (targetCssModule) {
                      server.moduleGraph.invalidateModule(targetCssModule);
                    }
                    server.ws.send({
                      type: 'prune',
                      paths: removedFontFiles.concat(targetCss),
                    });
                  }
                })(),
              );
              fullReload = true;
            }
          }

          if (preloadedChanged) promises.push(invalidatePreloadedFonts());
          if (fullReload)
            promises.push(
              (async () => {
                for (const server of servers) {
                  server.ws.send({
                    type: 'full-reload',
                  });
                }
                console.log('full-reload');
              })(),
            );

          await Promise.allSettled(promises);
        }
        fileFontImports.set(
          id,
          state.fontImports.map(
            (i) =>
              (i as import('estree').ImportDeclaration).source.value as string,
          ),
        );*/

        if (!this.getWatchFiles().includes(id)) {
          this.addWatchFile(id);
        }

        const escodegen = await importEscodegen();

        const s = new MagicString('');

        for (const node of ast.body) {
          s.append(escodegen.generate(node));
          s.append('\n');
        }

        return {
          code: s.toString(),
        };
      },
    },
  ];
};
