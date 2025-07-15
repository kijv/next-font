import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dataToEsm, normalizePath } from '@rollup/pluginutils'
import loaderUtils from 'loader-utils'
import MagicString from 'magic-string'
import type { FontLoader } from 'next-font'
import queryString from 'query-string'
import { isCSSRequest, type PluginOption, type ResolvedConfig } from 'vite'
import type { FontImportDataQuery } from '@/ast/transform'
import type { TargetCss } from '@/declarations'
import { nextFontPostcss } from '@/postcss'
import {
  createCachedImport,
  encodeURIPath,
  fontNameToUrl,
  getQuerySuffix,
  importResolve,
  normalizeTargetCssId,
  removeQuerySuffix,
  tryCatch,
} from '@/utils'

const googleLoader = createCachedImport<FontLoader>(() =>
  import('next-font/google/loader').then((mod) => mod.default)
)
const localLoader = createCachedImport<FontLoader>(() =>
  import('next-font/local/loader').then((mod) => mod.default)
)

export type OnFinished = (fileToFontNames: Map<string, string[]>) => Promise<void>

export const nextFontLoaderPlugin = ({
  fontImports,
  onFinished,
}: {
  fontImports: Record<string, TargetCss[]>
  onFinished: OnFinished
}): PluginOption[] => {
  let config: ResolvedConfig | null = null

  const fileToFontNames = new Map<string, string[]>()

  const loaderCache = {
    google: {
      css: new Map<string, string | null>(),
      font: new Map<string, string | null>(),
    },
    local: {
      css: new Map<string, string | null>(),
      font: new Map<string, string | null>(),
    },
  }
  const fontLoaders: [
    string,
    Promise<FontLoader> | FontLoader,
    (typeof loaderCache)[keyof typeof loaderCache],
  ][] = [
    ['next-font/google/target.css', googleLoader(), loaderCache.google],
    ['next-font/local/target.css', localLoader(), loaderCache.local],
  ] as const

  const targetCssMap = new Map<string, Awaited<ReturnType<typeof nextFontPostcss>>>()
  const targetCssAssets = new Map<string, string[]>()

  const fontFileMap = new Map<string, Buffer>()

  let lastEnv: string | null = null

  let calledFinished = false

  const loadSideEffects = new Set<() => void>()

  return [
    {
      name: 'next-fon:scan',
      enforce: 'pre',
      async configResolved(resolvedConfig) {
        config = resolvedConfig
      },
      configureServer(server) {
        return () => {
          server.middlewares.use((req, res, next) => {
            if (!req.originalUrl) return next()

            const content = fontFileMap.get(req.originalUrl)
            if (content) {
              res.end(content)
            } else next()
          })
        }
      },
    },
    {
      name: 'next-font:loader',
      load: {
        order: 'pre',
        async handler(id, opts) {
          if (!/\.css(?:$|\?)/.test(id)) return

          const { data: resolvedId, error } = await tryCatch(importResolve(removeQuerySuffix(id)))
          if (error) return null
          const pair = fontLoaders.find((id) => import.meta.resolve(id[0]) === resolvedId)
          if (!pair) return null

          const [, fontLoader, cache] = pair

          const normalizedId = normalizeTargetCssId(id)
          const isDev = config?.command === 'serve'

          if (
            // unnecessary to load the same file in dev mode
            isDev &&
            targetCssMap.has(normalizedId) &&
            lastEnv === this.environment.name
          )
            return
          lastEnv = this.environment.name

          const {
            path: relativePathFromRoot,
            import: functionName,
            arguments: stringifiedArguments,
            variableName,
          } = queryString.parse(getQuerySuffix(id)) as unknown as FontImportDataQuery & {
            arguments: string
          }

          const data = JSON.parse(stringifiedArguments)

          const fontNames: string[] = []

          const emitFontFile: Parameters<FontLoader>[0]['emitFontFile'] = (
            content: Buffer,
            ext: string,
            preload: boolean,
            isUsingSizeAdjust?: boolean
          ) => {
            const name = loaderUtils.interpolateName(
              // @ts-expect-error
              {},
              `static/media/[hash]${isUsingSizeAdjust ? '-s' : ''}${preload ? '.p' : ''}.${ext}`,
              {
                content,
              }
            )

            fontNames.push(name)

            const outputPath = fontNameToUrl(name)

            if (!isDev) {
              this.emitFile({
                type: 'asset',
                fileName: outputPath.slice(1),
                source: content,
              })
            }

            fontFileMap.set(outputPath, content)

            return outputPath
          }

          const absPath = path.join(config!.root, relativePathFromRoot)

          const fontData = await (await fontLoader)({
            functionName,
            variableName,
            data,
            emitFontFile,
            loaderContext: this,
            cache,
            isDev,
            isServer: opts?.ssr ?? false,
            id: relativePathFromRoot,
            resolve: (src) => {
              return path.join(path.dirname(absPath), src.startsWith('.') ? src : `./${src}`)
            },
          })

          fileToFontNames.set(absPath, (fileToFontNames.get(absPath) || []).concat(fontNames))

          const targetCss = await nextFontPostcss(relativePathFromRoot, fontData)

          if (fontImports[absPath]) {
            for (const fontImport of fontImports[absPath]) {
              if (
                fileURLToPath(import.meta.resolve(removeQuerySuffix(fontImport.id))).concat(
                  getQuerySuffix(fontImport.id)
                ) === encodeURIPath(id)
              ) {
                fontImport.css = targetCss.code
              }
            }

            if (!calledFinished && !Object.values(fontImports).flat().length) {
              await onFinished(fileToFontNames).finally(() => {
                calledFinished = true
              })
            }
          }

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

          targetCssMap.set(normalizedId, targetCss)
        },
      },
      transform: {
        order: 'post',
        async handler(_code, id, opts) {
          if (!/\.css(?:$|\?)/.test(id)) return

          const normalizedId = normalizeTargetCssId(id)

          const targetCss = targetCssMap.get(normalizedId)
          if (!targetCss) return
          const { modules, code: css } = targetCss

          const modulesCode = dataToEsm(modules, {
            namedExports: true,
            preferConst: true,
          })

          const map = config?.css.devSourcemap
            ? new MagicString(css).generateMap({ hires: true })
            : undefined
          if (config?.command === 'serve' && !opts?.ssr) {
            const code = [
              `import { updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle } from ${JSON.stringify(
                path.posix.join(config.base, '/@vite/client')
              )}`,
              `const __vite__id = ${JSON.stringify(id)}`,
              `const __vite__css = ${JSON.stringify(css)}`,
              `__vite__updateStyle(__vite__id, __vite__css)`,
              // css modules exports change on edit so it can't self accept
              `${modulesCode || 'import.meta.hot.accept()'}
                        if (import.meta.hot) {
                          import.meta.hot.prune(() => __vite__removeStyle(__vite__id))
                        }`,
            ].join('\n')
            return {
              code,
              map,
            }
          }

          return {
            code: modulesCode,
            map,
            moduleSideEffects: false,
          }
        },
      },
    },
    {
      name: 'next-font:build',
      apply: 'build',
      renderChunk: {
        order: 'post',
        async handler(_code, chunk) {
          const resolvedModuleIds = (
            await Promise.all(
              chunk.moduleIds.map(async (moduleId) =>
                this.resolve(moduleId).then((resolved) => resolved?.id)
              )
            )
          ).filter(Boolean) as string[]

          if (resolvedModuleIds.length) {
            const targetCss = resolvedModuleIds
              .map(
                (id) =>
                  Object.assign({}, targetCssMap.get(normalizeTargetCssId(id)) ?? {}, { id }) as {
                    id: string
                    code?: string
                  }
              )
              .filter((t) => t != null && 'code' in t && typeof t.code === 'string')
            const chunkCSS = targetCss.map((t) => t.code).join()

            function ensureFileExt(name: string, ext: string) {
              return normalizePath(path.format({ ...path.parse(name), base: undefined, ext }))
            }

            if (chunkCSS) {
              const cssFullAssetName = ensureFileExt(chunk.name, '.css')
              // if facadeModuleId doesn't exist or doesn't have a CSS extension,
              // that means a JS entry file imports a CSS file.
              // in this case, only use the filename for the CSS chunk name like JS chunks.
              const cssAssetName =
                chunk.isEntry && (!chunk.facadeModuleId || !isCSSRequest(chunk.facadeModuleId))
                  ? path.basename(cssFullAssetName)
                  : cssFullAssetName

              // emit corresponding css file
              const referenceId = this.emitFile({
                type: 'asset',
                name: cssAssetName,
                source: chunkCSS,
              })
              chunk.viteMetadata!.importedCss.add(this.getFileName(referenceId))

              for (const fileName of targetCss
                .flatMap((t) => targetCssAssets.get(t.id))
                .filter(Boolean) as string[]) {
                chunk.viteMetadata!.importedAssets.add(fileName)
              }
            }
          }

          return null
        },
      },
    },
  ]
}
