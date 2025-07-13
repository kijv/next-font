import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataToEsm } from '@rollup/pluginutils';
import loaderUtils from 'loader-utils';
import MagicString from 'magic-string';
import queryString from 'query-string';
import type { PluginOption, ResolvedConfig } from 'vite';
import type { FontImportDataQuery } from '@/ast/transform';
import type { FontLoader, FontLoaderOptions } from '@/declarations';
import { nextFontPostcss, normalizeTargetCssId } from '@/postcss';
import {
  createCachedImport,
  encodeURIPath,
  fontNameToUrl,
  getQuerySuffix,
  importResolve,
  removeQuerySuffix,
  tryCatch,
} from '@/utils';

const googleLoader = createCachedImport<FontLoader>(() =>
  import('@/loaders/google').then((mod) => mod.default),
);
const localLoader = createCachedImport<FontLoader>(() =>
  import('@/loaders/local').then((mod) => mod.default),
);

export type OnFinished = (
  fileToFontNames: Map<string, string[]>,
) => Promise<void>;

export const nextFontLoaderPlugin = ({
  fontImports,
  onFinished,
}: {
  fontImports: Record<string, string[]>;
  onFinished: OnFinished;
}): PluginOption[] => {
  let config: ResolvedConfig | null = null;

  const fileToFontNames = new Map<string, string[]>();

  const loaderCache = {
    google: {
      css: new Map<string, string | null>(),
      font: new Map<string, string | null>(),
    },
    local: {
      css: new Map<string, string | null>(),
      font: new Map<string, string | null>(),
    },
  };
  const fontLoaders: [
    string,
    Promise<FontLoader> | FontLoader,
    (typeof loaderCache)[keyof typeof loaderCache],
  ][] = [
    ['next-font/google/target.css', googleLoader(), loaderCache.google],
    ['next-font/local/target.css', localLoader(), loaderCache.local],
  ] as const;

  const targetCssMap = new Map<
    string,
    Awaited<ReturnType<typeof nextFontPostcss>>
  >();

  const fontFileMap = new Map<string, Buffer>();

  let calledFinished = false;

  return [
    {
      name: 'next-fon:scan',
      enforce: 'pre',
      async configResolved(resolvedConfig) {
        config = resolvedConfig;
      },
      configureServer(server) {
        console.log('configureServer')
        return () => {
          server.middlewares.use((req, res, next) => {
            if (!req.originalUrl) return next();

            const content = fontFileMap.get(req.originalUrl);
            if (content) {
              res.end(content);
            } else next();
          });
        };
      }
    },
    {
      name: 'next-font:loader',
      load: {
        order: 'pre',
        async handler(id, opts) {
          if (!/\.css(?:$|\?)/.test(id)) return;

          const { data: resolvedId, error } = await tryCatch(
            importResolve(removeQuerySuffix(id)),
          );
          if (error) return null;
          const pair = fontLoaders.find(
            (id) => import.meta.resolve(id[0]) === resolvedId,
          );
          if (!pair) return null;

          const normalizedId = normalizeTargetCssId(id);

          if (targetCssMap.has(normalizedId)) return;

          const isDev = config?.command === 'serve';
          const fontLoader = await pair[1];

          const tempFileCache = new Map<string, Buffer>();

          const {
            path: relativePathFromRoot,
            import: functionName,
            arguments: stringifiedArguments,
            variableName,
          } = queryString.parse(
            getQuerySuffix(id),
          ) as unknown as FontImportDataQuery & {
            arguments: string;
          };

          const data = JSON.parse(stringifiedArguments);

          const fontNames: string[] = [];

          const emitFontFile: FontLoaderOptions['emitFontFile'] = (
            content: Buffer,
            ext: string,
            preload: boolean,
            isUsingSizeAdjust?: boolean,
          ) => {
            const name = loaderUtils.interpolateName(
              // @ts-expect-error
              {},
              `static/media/[hash]${isUsingSizeAdjust ? '-s' : ''}${preload ? '.p' : ''}.${ext}`,
              {
                content,
              },
            );

            fontNames.push(name);

            const outputPath = fontNameToUrl(name, config);

            if (!isDev) {
              this.emitFile({
                type: 'asset',
                fileName: outputPath.slice(1),
                source: content,
              });
            } else {
              fontFileMap.set(outputPath, content);
            }

            tempFileCache.set(outputPath, content);

            return outputPath;
          };

          const absPath = path.join(config!.root, relativePathFromRoot);

          const fontData = await fontLoader({
            functionName,
            variableName,
            data,
            emitFontFile,
            ctx: this,
            cache: pair[2],
            isDev,
            isServer: opts?.ssr ?? false,
            id: relativePathFromRoot,
            resolve: (src) => {
              return path.join(
                path.dirname(absPath),
                src.startsWith('.') ? src : `./${src}`,
              );
            },
          });

          fileToFontNames.set(
            absPath,
            (fileToFontNames.get(absPath) || []).concat(fontNames),
          );

          if (fontImports[absPath]) {
            fontImports[absPath] = fontImports[absPath].filter(
              (item) =>
                encodeURIPath(
                  fileURLToPath(
                    import.meta.resolve(removeQuerySuffix(item)),
                  ).concat(getQuerySuffix(item)),
                ) !== encodeURIPath(id),
            );

            if (!calledFinished && !Object.values(fontImports).flat().length) {
              await onFinished(fileToFontNames).finally(() => {
                calledFinished = true;
              });
            }
          }

          const targetCss = await nextFontPostcss(
            relativePathFromRoot,
            fontData,
          );

          /*
          let preloadedChanged = false;

          for (const [key, value] of tempFileCache.entries()) {
            const { preloaded } = fontFileCache.set(key, value);
            preloadedChanged = preloadedChanged || preloaded;
          }

          if (preloadedChanged) {
            invalidatePreloadedFonts();
          }
          */

          /*
          targetCssToFontFile.set(
            normalizedId,
            Array.from(tempFileCache.keys()),
          );
          targetCssCache.set(normalizedId, targetCss);
          */

          targetCssMap.set(normalizedId, targetCss);

          return targetCss.code;
        },
      },
      transform: {
        order: 'post',
        async handler(_code, id, opts) {
          if (!/\.css(?:$|\?)/.test(id)) return;

          const normalizedId = normalizeTargetCssId(id);

          const targetCss = targetCssMap.get(normalizedId);
          if (!targetCss) return;
          const { modules, code: css } = targetCss;

          const modulesCode = dataToEsm(modules, {
            namedExports: true,
            preferConst: true,
          });

          const map = config?.css.devSourcemap
            ? new MagicString(css).generateMap({ hires: true })
            : undefined;
          if (config?.command === 'serve' && !opts?.ssr) {
            const code = [
              `import { updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle } from ${JSON.stringify(
                path.posix.join(config.base, '/@vite/client'),
              )}`,
              `const __vite__id = ${JSON.stringify(id)}`,
              `const __vite__css = ${JSON.stringify(css)}`,
              `__vite__updateStyle(__vite__id, __vite__css)`,
              // css modules exports change on edit so it can't self accept
              `${modulesCode || 'import.meta.hot.accept()'}
                        if (import.meta.hot) {
                          import.meta.hot.prune(() => __vite__removeStyle(__vite__id))
                        }`,
            ].join('\n');
            return {
              code,
              map,
            };
          }

          // styles.set(id, css);

          return {
            code: modulesCode,
            map,
            moduleSideEffects: false,
          };
        },
      },
    },
    {
      name: 'next-font:build',
      apply: 'build',
      enforce: 'post',
      async renderChunk(code, chunk, opts) {
        /*
        const chunkCSS = Array.from(styles.values()).join();

        function ensureFileExt(name: string, ext: string) {
          return normalizePath(
            path.format({ ...path.parse(name), base: undefined, ext }),
          );
        }

        let s: MagicString | undefined;

        if (chunkCSS) {
          if (this.environment.config.build.cssCodeSplit) {
            if (opts.format === 'es' || opts.format === 'cjs') {
              const cssFullAssetName = ensureFileExt(chunk.name, '.css');
              // if facadeModuleId doesn't exist or doesn't have a CSS extension,
              // that means a JS entry file imports a CSS file.
              // in this case, only use the filename for the CSS chunk name like JS chunks.
              const cssAssetName =
                chunk.isEntry &&
                (!chunk.facadeModuleId || !isCSSRequest(chunk.facadeModuleId))
                  ? path.basename(cssFullAssetName)
                  : cssFullAssetName;

              // emit corresponding css file
              const referenceId = this.emitFile({
                type: 'asset',
                name: cssAssetName,
                // originalFileName,
                source: chunkCSS,
              });
              chunk.viteMetadata!.importedCss.add(
                this.getFileName(referenceId),
              );
            } else if (this.environment.config.consumer === 'client') {
              // legacy build and inline css

              // Entry chunk CSS will be collected into `chunk.viteMetadata.importedCss`
              // and injected later by the `'vite:build-html'` plugin into the `index.html`
              // so it will be duplicated. (https://github.com/vitejs/vite/issues/2062#issuecomment-782388010)
              // But because entry chunk can be imported by dynamic import,
              // we shouldn't remove the inlined CSS. (#10285)

              const cssString = JSON.stringify(chunkCSS);
              // cssString =
              //   renderAssetUrlInJS(this, chunk, opts, cssString)?.toString() ||
              //   cssString;
              const style = `__vite_style__`;
              const injectCode =
                `var ${style} = document.createElement('style');` +
                `${style}.textContent = ${cssString};` +
                `document.head.appendChild(${style});`;
              let injectionPoint: number;
              const wrapIdx = code.indexOf('System.register');
              const singleQuoteUseStrict = `'use strict';`;
              const doubleQuoteUseStrict = `"use strict";`;
              if (wrapIdx >= 0) {
                const executeFnStart = code.indexOf('execute:', wrapIdx);
                injectionPoint = code.indexOf('{', executeFnStart) + 1;
              } else if (code.includes(singleQuoteUseStrict)) {
                injectionPoint =
                  code.indexOf(singleQuoteUseStrict) +
                  singleQuoteUseStrict.length;
              } else if (code.includes(doubleQuoteUseStrict)) {
                injectionPoint =
                  code.indexOf(doubleQuoteUseStrict) +
                  doubleQuoteUseStrict.length;
              } else {
                throw new Error('Injection point for inlined CSS not found');
              }
              s ||= new MagicString(code);
              s.appendRight(injectionPoint, injectCode);
            }
          } else {
            // @ts-expect-error
            const publicAssetUrlMap = publicAssetUrlCache.get(config!)!;

            // resolve asset URL placeholders to their built file URLs
            const resolveAssetUrlsInCss = (
              chunkCSS: string,
              cssAssetName: string
            ) => {
              const encodedPublicUrls = config?.command === "build";

              const relative = config?.base === "./" || config?.base === "";
              const cssAssetDirname =
                encodedPublicUrls || relative
                  ? slash(getCssAssetDirname(cssAssetName))
                  : undefined;

              const toRelative = (filename: string) => {
                // relative base + extracted CSS
                const relativePath = normalizePath(
                  path.relative(cssAssetDirname!, filename)
                );
                return relativePath[0] === "."
                  ? relativePath
                  : "./" + relativePath;
              };

              // replace asset url references with resolved url.
              chunkCSS = chunkCSS.replace(
                assetUrlRE,
                (_, fileHash, postfix = "") => {
                  const filename = this.getFileName(fileHash) + postfix;
                  chunk.viteMetadata!.importedAssets.add(cleanUrl(filename));
                  return encodeURIPath(
                    toOutputFilePathInCss(
                      filename,
                      "asset",
                      cssAssetName,
                      "css",
                      // @ts-expect-error
                      config,
                      toRelative
                    )
                  );
                }
              );
              // resolve public URL from CSS paths
              if (encodedPublicUrls) {
                const relativePathToPublicFromCSS = normalizePath(
                  path.relative(cssAssetDirname!, "")
                );
                chunkCSS = chunkCSS.replace(publicAssetUrlRE, (_, hash) => {
                  const publicUrl = publicAssetUrlMap.get(hash)!.slice(1);
                  return encodeURIPath(
                    toOutputFilePathInCss(
                      publicUrl,
                      "public",
                      cssAssetName,
                      "css",
                      // @ts-ignore
                      config!,
                      () => `${relativePathToPublicFromCSS}/${publicUrl}`
                    )
                  );
                });
              }
              return chunkCSS;
            };

            // resolve public URL from CSS paths, we need to use absolute paths
            chunkCSS = resolveAssetUrlsInCss(chunkCSS, getCssBundleName());
            // finalizeCss is called for the aggregated chunk in generateBundle

            chunkCSSMap.set(chunk.fileName, chunkCSS);
          }
        }

        if (s) {
          if (config?.build.sourcemap) {
            return {
              code: s.toString(),
              map: s.generateMap({ hires: 'boundary' }),
            };
          } else {
            return { code: s.toString() };
          }
        }
        */

        return null;
      },
    },
  ];
};
