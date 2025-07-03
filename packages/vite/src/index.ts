import path from "node:path";
import { dataToEsm, normalizePath } from "@rollup/pluginutils";
import escodegen from "escodegen-wallaby";
import MagicString from "magic-string";
import {
  isCSSRequest,
  type PluginOption,
  type ResolvedConfig,
  type ViteDevServer,
} from "vite";
import { visit } from "./ast/transform";
import type { FontLoader } from "./declarations";
import { compileTargetCss } from "./target-css";
import { importResolve, removeQuerySuffix, tryCatch } from "./utils";
import {
  renderAssetUrlInJS,
  //   assetUrlRE,
  //   publicAssetUrlRE,
  //   publicAssetUrlCache,
} from '@vitejs/vite/packages/vite/src/node/plugins/asset';
import escodegen from 'escodegen-wallaby';
import MagicString from 'magic-string';
import {
  isCSSRequest,
  type PluginOption,
  type ResolvedConfig,
  type ViteDevServer,
} from 'vite';
import { visit } from './ast/transform';
import type { FontLoader } from './declarations';
import { compileTargetCss } from './target-css';
import { importResolve, removeQuerySuffix, tryCatch } from './utils';

// import { encodeURIPath } from "@vitejs/vite/packages/vite/src/node/utils";
// import { toOutputFilePathInCss } from "@vitejs/vite/packages/vite/src/node/build";
// import { slash, cleanUrl } from "@vitejs/vite/packages/vite/src/shared/utils";

const plugin = (): PluginOption[] => {
  const rewriteNextFontImport = {
    '@next/font/google': 'next-font/google',
    '@next/font/local': 'next-font/local',
    'next/font/google': 'next-font/google',
    'next/font/local': 'next-font/local',
  };
  const importedLoaders = ["next-font/google", "next-font/local"];
  const fontLoaders: [string, Promise<FontLoader>][] = [
    [
      "next-font/google/target.css",
      import("./google").then((mod) => mod.default),
    ],
    [
      "next-font/local/target.css",
      import("./local").then((mod) => mod.default),
    ],
  ] as const;
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

  const targetCssCache = new Map<string, ReturnType<typeof compileTargetCss>>();
  const fileCache = new Map<string, Buffer>();

  const servers: ViteDevServer[] = [];
  let config: ResolvedConfig | null = null;

  const styles = new Map<string, string>();
  // let isSSR = false;
  let minify = false;

  return [
    {
      name: "next-font:scan",
      enforce: "pre",
      configureServer(server) {
        servers.push(server);
      },
      async configResolved(resolvedConfig) {
        config = resolvedConfig;
        minify = config.build.cssMinify !== false;
        // isSSR = config.build.ssr !== false && config.build.ssr !== undefined;
      },
    },
    {
      name: "next-font:transform",
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

        const { changed } = visit({
          ast,
          fontLoaders: importedLoaders,
          id: path.relative(config!.root, id),
          remapImports: rewriteNextFontImport,
        });

        if (!changed) return;

        const s = new MagicString("");

        for (const node of ast.body) {
          s.append(escodegen.generate(node));
          s.append("\n");
        }
        return {
          code: s.toString(),
        };
      },
    },
    {
      name: "next-font:generate:pre",
      enforce: "pre",
      configureServer(server) {
        return () => {
          server.middlewares.use((req, res, next) => {
            const content = fileCache.get(req.originalUrl!);
            if (content) {
              res.end(content);
            } else next();
          });
        };
      },
      async load(this, id, opts) {
        if (!/\.css(?:$|\?)/.test(id)) return null;
        const { data: resolvedId, error } = await tryCatch(
          importResolve(removeQuerySuffix(id))
        );
        if (error) return null;
        const pair = fontLoaders.find(
          (id) => import.meta.resolve(id[0]) === resolvedId
        );
        if (!pair) return null;

        const targetCss = compileTargetCss({
          id,
          fontLoader: pair[1],
          loaderCache,
          fileCache,
          ctx: this,
          isDev: config?.command === "serve",
          isServer: opts?.ssr ?? false,
          config: config!,
        });

        targetCssCache.set(id, targetCss);
      },
    },
    {
      name: "next-font:generate:post",
      enforce: "post",
      async transform(this, _code, id, opts) {
        const targetCss = targetCssCache.get(id);

        if (targetCss) {
          const { modules, code: css } = await targetCss;

          const modulesCode = dataToEsm(modules, {
            namedExports: true,
            preferConst: true,
          });

          const map = config?.css.devSourcemap
            ? new MagicString(css).generateMap({ hires: true })
            : undefined;

          if (config?.command === "serve" && !opts?.ssr) {
            const code = [
              `import { updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle } from ${JSON.stringify(
                path.posix.join(config.base, "/@vite/client")
              )}`,
              `const __vite__id = ${JSON.stringify(id)}`,
              `const __vite__css = ${JSON.stringify(css)}`,
              `__vite__updateStyle(__vite__id, __vite__css)`,
              // css modules exports change on edit so it can't self accept
              `${
                modulesCode ||
                "import.meta.hot.accept()\nimport.meta.hot.prune(() => __vite__removeStyle(__vite__id))"
              }`,
            ].join("\n");
            return {
              code,
              map,
            };
          }

          styles.set(id, css);

          return {
            code: modulesCode,
            map,
            moduleSideEffects: false,
          };
        }
      },
    },
    {
      name: "next-font:generate:build",
      apply: "build",
      enforce: "post",
      async renderChunk(code, chunk, opts) {
        let chunkCSS = Array.from(styles.values()).join();

        function ensureFileExt(name: string, ext: string) {
          return normalizePath(
            path.format({ ...path.parse(name), base: undefined, ext })
          );
        }

        let s: MagicString | undefined;

        if (chunkCSS) {
          if (this.environment.config.build.cssCodeSplit) {
            if (opts.format === "es" || opts.format === "cjs") {
              const cssFullAssetName = ensureFileExt(chunk.name, ".css");
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
                type: "asset",
                name: cssAssetName,
                // originalFileName,
                source: chunkCSS,
              });
              chunk.viteMetadata!.importedCss.add(
                this.getFileName(referenceId)
              );
            } else if (this.environment.config.consumer === "client") {
              // legacy build and inline css

              // Entry chunk CSS will be collected into `chunk.viteMetadata.importedCss`
              // and injected later by the `'vite:build-html'` plugin into the `index.html`
              // so it will be duplicated. (https://github.com/vitejs/vite/issues/2062#issuecomment-782388010)
              // But because entry chunk can be imported by dynamic import,
              // we shouldn't remove the inlined CSS. (#10285)

              let cssString = JSON.stringify(chunkCSS);
              cssString =
                renderAssetUrlInJS(this, chunk, opts, cssString)?.toString() ||
                cssString;
              const style = `__vite_style__`;
              const injectCode =
                `var ${style} = document.createElement('style');` +
                `${style}.textContent = ${cssString};` +
                `document.head.appendChild(${style});`;
              let injectionPoint: number;
              const wrapIdx = code.indexOf("System.register");
              const singleQuoteUseStrict = `'use strict';`;
              const doubleQuoteUseStrict = `"use strict";`;
              if (wrapIdx >= 0) {
                const executeFnStart = code.indexOf("execute:", wrapIdx);
                injectionPoint = code.indexOf("{", executeFnStart) + 1;
              } else if (code.includes(singleQuoteUseStrict)) {
                injectionPoint =
                  code.indexOf(singleQuoteUseStrict) +
                  singleQuoteUseStrict.length;
              } else if (code.includes(doubleQuoteUseStrict)) {
                injectionPoint =
                  code.indexOf(doubleQuoteUseStrict) +
                  doubleQuoteUseStrict.length;
              } else {
                throw new Error("Injection point for inlined CSS not found");
              }
              s ||= new MagicString(code);
              s.appendRight(injectionPoint, injectCode);
            }
          } else {
            /*
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
            */
          }
        }

        if (s) {
          if (config?.build.sourcemap) {
            return {
              code: s.toString(),
              map: s.generateMap({ hires: "boundary" }),
            };
          } else {
            return { code: s.toString() };
          }
        }

        return null;
      },
    },
  ] as PluginOption[];
};

export default plugin;
